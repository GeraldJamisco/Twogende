<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Enums\RatedRole;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use App\Support\RatingTags;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The driver's end-of-trip screen: what the ride earned, what Twogende kept,
 * and the passengers still owed a rating.
 */
class DriverEarningsTest extends TestCase
{
    use RefreshDatabase;

    private function tripWithPassengers(array $contributions): Trip
    {
        $trip = Trip::factory()->withSeats(4)->create([
            'departure_at' => now()->subHours(2),
            'contribution_per_seat' => $contributions[0],
        ]);

        $trip->forceFill(['started_at' => now()->subHours(2)])->save();

        foreach ($contributions as $amount) {
            Booking::factory()->for($trip)->create([
                'status' => BookingStatus::Accepted,
                'seats' => 1,
                'contribution_per_seat' => $amount,
                'total_contribution' => $amount,
            ]);
        }

        return $trip;
    }

    public function test_completing_a_trip_fixes_the_commission_on_every_seat(): void
    {
        $trip = $this->tripWithPassengers([15_000, 15_000, 15_000]);

        $trip->complete();

        foreach ($trip->bookings()->get() as $booking) {
            $this->assertSame(3_000, $booking->service_fee);  // 20% of 15,000
            $this->assertSame(12_000, $booking->driverPayout());
        }
    }

    public function test_a_later_rate_change_cannot_rewrite_a_finished_trip(): void
    {
        $trip = $this->tripWithPassengers([15_000]);
        $trip->complete();

        config(['twogende.platform.commission_rate' => 0.35]);

        Sanctum::actingAs($trip->driver);

        $this->getJson("/api/v1/trips/{$trip->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.earnings.service_fee', 3_000)
            ->assertJsonPath('data.earnings.net', 12_000);
    }

    public function test_the_split_always_adds_back_up_to_what_was_contributed(): void
    {
        // Amounts that don't divide cleanly by five, so rounding has to be
        // absorbed somewhere. It must never be lost.
        $trip = $this->tripWithPassengers([12_500, 7_777, 3_333]);
        $trip->complete();

        Sanctum::actingAs($trip->driver);

        $summary = $this->getJson("/api/v1/trips/{$trip->id}/summary")
            ->assertOk()
            ->json('data');

        $this->assertSame(23_610, $summary['earnings']['gross']);
        $this->assertSame(
            $summary['earnings']['gross'],
            $summary['earnings']['service_fee'] + $summary['earnings']['net'],
        );

        // And the per-passenger lines add up to the headline figures.
        $this->assertSame(
            $summary['earnings']['service_fee'],
            array_sum(array_column($summary['passengers'], 'service_fee')),
        );
    }

    public function test_the_summary_lists_who_still_needs_rating(): void
    {
        $trip = $this->tripWithPassengers([10_000, 10_000]);
        $trip->complete();

        Sanctum::actingAs($trip->driver);

        $summary = $this->getJson("/api/v1/trips/{$trip->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.seats_filled', 2)
            ->assertJsonPath('data.duration_minutes', 120)
            ->json('data');

        $this->assertCount(2, $summary['passengers']);
        $this->assertTrue($summary['passengers'][0]['rating_due']);

        // A passenger's phone number must not ride along in the summary.
        $this->assertArrayNotHasKey('phone', $summary['passengers'][0]['passenger']);

        // Rate one, and only the other is still outstanding.
        $rated = $summary['passengers'][0]['booking_id'];
        $this->postJson("/api/v1/bookings/{$rated}/rating", ['stars' => 5])->assertCreated();

        $this->getJson("/api/v1/trips/{$trip->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.passengers.0.rating_due', false)
            ->assertJsonPath('data.passengers.1.rating_due', true);
    }

    public function test_a_passenger_cannot_read_the_drivers_earnings(): void
    {
        $trip = $this->tripWithPassengers([10_000]);
        $trip->complete();

        Sanctum::actingAs($trip->bookings()->first()->passenger);

        $this->getJson("/api/v1/trips/{$trip->id}/summary")->assertForbidden();
    }

    public function test_duration_is_absent_when_the_driver_never_pressed_start(): void
    {
        $trip = $this->tripWithPassengers([10_000]);
        $trip->forceFill(['started_at' => null])->save();
        $trip->complete();

        Sanctum::actingAs($trip->driver);

        $this->getJson("/api/v1/trips/{$trip->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.duration_minutes', null);
    }

    public function test_tags_become_percentages_on_a_profile(): void
    {
        $driver = User::factory()->identityVerified()->create();

        // Four people mention the driving: three say it was smooth, one says
        // it was reckless. That is a 75% category, headlined by the praise.
        $tagSets = [
            [5, ['smooth_driving', 'on_time']],
            [5, ['smooth_driving', 'on_time']],
            [5, ['smooth_driving', 'clean_car']],
            [1, ['reckless_driving']],
        ];

        foreach ($tagSets as [$stars, $tags]) {
            $trip = Trip::factory()->withSeats(3)->for($driver, 'driver')->create([
                'departure_at' => now()->subHours(2),
            ]);
            $booking = Booking::factory()->for($trip)->create(['status' => BookingStatus::Accepted]);
            $trip->complete();

            Sanctum::actingAs($booking->passenger);
            $this->postJson("/api/v1/bookings/{$booking->id}/rating", [
                'stars' => $stars,
                'tags' => $tags,
            ])->assertCreated();
        }

        $highlights = collect(RatingTags::highlightsFor($driver, RatedRole::Driver))
            ->keyBy('category');

        $this->assertSame(75, $highlights['driving']['percent']);
        $this->assertSame('Smooth driving', $highlights['driving']['label']);
        $this->assertSame(4, $highlights['driving']['mentions']);

        // "Clean car" was said once. One voice is not a statistic.
        $this->assertArrayNotHasKey('vehicle', $highlights->all());

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/users/{$driver->id}")
            ->assertOk()
            ->assertJsonPath('data.highlights.as_driver.0.category', 'driving')
            ->assertJsonPath('data.highlights.as_driver.0.percent', 75);
    }
}
