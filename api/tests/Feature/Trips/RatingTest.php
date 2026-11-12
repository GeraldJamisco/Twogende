<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Enums\RatedRole;
use App\Enums\RatingCategory;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Rating the other side once the ride is over.
 *
 * The reputation numbers on a profile are denormalised, so most of what
 * matters here is that they stay equal to the ratings underneath them.
 */
class RatingTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Trip, 1: Booking} A finished ride, ready to be rated. */
    private function finishedRide(): array
    {
        $trip = Trip::factory()->withSeats(3)->create([
            'departure_at' => now()->subHours(2),
            'status' => TripStatus::Completed,
        ]);

        $booking = Booking::factory()->for($trip)->create([
            'status' => BookingStatus::Completed,
        ]);

        return [$trip, $booking];
    }

    public function test_a_passenger_rates_the_driver_and_the_profile_score_moves(): void
    {
        [$trip, $booking] = $this->finishedRide();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", [
            'stars' => 5,
            'tags' => ['smooth_driving', 'on_time'],
            'comment' => 'Knew a shortcut past the Northern Bypass jam.',
        ])->assertCreated()
            ->assertJsonPath('data.stars', 5)
            ->assertJsonPath('data.ratee_role', RatedRole::Driver->value)
            ->assertJsonPath('data.tags', ['smooth_driving', 'on_time']);

        $driver = $trip->driver->fresh();
        $this->assertSame(5.0, $driver->rating_as_driver);
        $this->assertSame(1, $driver->ratings_as_driver_count);

        // The passenger's own score is untouched - this rating was about the driver.
        $this->assertNull($booking->passenger->fresh()->rating_as_passenger);
    }

    public function test_the_driver_rates_the_passenger(): void
    {
        [$trip, $booking] = $this->finishedRide();
        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", [
            'stars' => 4,
            'tags' => ['friendly', 'on_time'],
        ])->assertCreated()
            ->assertJsonPath('data.ratee_role', RatedRole::Passenger->value);

        $passenger = $booking->passenger->fresh();
        $this->assertSame(4.0, $passenger->rating_as_passenger);
        $this->assertSame(1, $passenger->ratings_as_passenger_count);
        $this->assertNull($trip->driver->fresh()->rating_as_driver);
    }

    public function test_the_average_is_recomputed_from_every_rating(): void
    {
        $driver = User::factory()->identityVerified()->create();

        foreach ([5, 4, 5, 3] as $stars) {
            $trip = Trip::factory()->withSeats(3)->for($driver, 'driver')->create([
                'departure_at' => now()->subHours(2),
                'status' => TripStatus::Completed,
            ]);

            $booking = Booking::factory()->for($trip)->create([
                'status' => BookingStatus::Completed,
            ]);

            Sanctum::actingAs($booking->passenger);
            $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => $stars])
                ->assertCreated();
        }

        $driver->refresh();
        $this->assertSame(4.25, $driver->rating_as_driver);
        $this->assertSame(4, $driver->ratings_as_driver_count);
    }

    public function test_nobody_rates_a_ride_that_has_not_finished(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['departure_at' => now()->addHour()]);
        $booking = Booking::factory()->for($trip)->create(['status' => BookingStatus::Accepted]);

        Sanctum::actingAs($booking->passenger);

        $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('due', false);

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 5])
            ->assertStatus(422);

        $this->assertSame(0, $booking->ratings()->count());
    }

    public function test_a_rating_can_only_be_left_once(): void
    {
        [, $booking] = $this->finishedRide();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 5])->assertCreated();

        $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('due', false);

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 1])
            ->assertStatus(422);

        $this->assertSame(1, $booking->ratings()->count());
    }

    public function test_a_stranger_cannot_rate_somebody_elses_ride(): void
    {
        [, $booking] = $this->finishedRide();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 1])
            ->assertForbidden();
    }

    public function test_tags_have_to_belong_to_the_stars_they_were_offered_under(): void
    {
        [, $booking] = $this->finishedRide();
        Sanctum::actingAs($booking->passenger);

        // "Reckless driving" is offered at one star, never alongside five.
        $this->postJson("/api/v1/bookings/{$booking->id}/rating", [
            'stars' => 5,
            'tags' => ['reckless_driving'],
        ])->assertStatus(422)->assertJsonValidationErrors('tags.0');

        $this->assertSame(0, $booking->ratings()->count());
    }

    public function test_what_they_said_stays_sealed_until_you_have_rated_back(): void
    {
        [$trip, $booking] = $this->finishedRide();
        $booking->forceFill(['completed_at' => now()])->save();

        // The passenger goes first.
        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 5])
            ->assertCreated()
            // Nobody has rated them back, so there is nothing to wait for.
            ->assertJsonPath('their_rating.waiting', false);

        // The driver can see a rating exists, but not what it says.
        Sanctum::actingAs($trip->driver);
        $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('their_rating.waiting', true)
            ->assertJsonPath('their_rating.revealed', false)
            ->assertJsonPath('their_rating.rating', null);

        // Rating back opens it, in the same response.
        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 4])
            ->assertCreated()
            ->assertJsonPath('their_rating.revealed', true)
            ->assertJsonPath('their_rating.rating.stars', 5);
    }

    public function test_a_sealed_rating_opens_on_its_own_eventually(): void
    {
        [$trip, $booking] = $this->finishedRide();
        $booking->forceFill(['completed_at' => now()])->save();

        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/rating", ['stars' => 2])->assertCreated();

        // The driver never rates back. A rating nobody can ever read is a
        // rating that may as well not have been left.
        Sanctum::actingAs($trip->driver);
        $this->travel(config('twogende.ratings.reveal_after_days') + 1)->days();

        $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('their_rating.revealed', true)
            ->assertJsonPath('their_rating.rating.stars', 2);
    }

    public function test_the_pending_check_says_which_way_round_the_rating_goes(): void
    {
        [$trip, $booking] = $this->finishedRide();

        Sanctum::actingAs($booking->passenger);
        $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('due', true)
            ->assertJsonPath('rating_role', RatedRole::Driver->value)
            ->assertJsonPath('tags.5.0.category', RatingCategory::Driving->value);

        // A driver is asked a different set of questions: nothing about the
        // car, nothing about the driving.
        Sanctum::actingAs($trip->driver);
        $response = $this->getJson("/api/v1/bookings/{$booking->id}/rating")
            ->assertOk()
            ->assertJsonPath('rating_role', RatedRole::Passenger->value);

        $categories = collect($response->json('tags.5'))->pluck('category');
        $this->assertFalse($categories->contains(RatingCategory::Driving->value));
        $this->assertFalse($categories->contains(RatingCategory::Vehicle->value));
    }
}
