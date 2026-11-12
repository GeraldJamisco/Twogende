<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The tracking screen's four steps, and the bar that sits on the home screen
 * for the whole of a journey.
 */
class RideTrackingTest extends TestCase
{
    use RefreshDatabase;

    private const PICKUP = ['lat' => 0.3563, 'lng' => 32.6103];

    /** @return array{0: Trip, 1: Booking} */
    private function ride(array $bookingState = []): array
    {
        $trip = Trip::factory()->withSeats(3)->create([
            'origin_lat' => self::PICKUP['lat'],
            'origin_lng' => self::PICKUP['lng'],
            'departure_at' => now()->addMinutes(20),
        ]);

        $booking = Booking::factory()->for($trip)->create(array_merge([
            'status' => BookingStatus::Accepted,
            'pickup_lat' => self::PICKUP['lat'],
            'pickup_lng' => self::PICKUP['lng'],
        ], $bookingState));

        return [$trip, $booking];
    }

    public function test_the_stage_follows_the_ride(): void
    {
        [$trip, $booking] = $this->ride(['status' => BookingStatus::Pending]);
        $this->assertSame('requested', $booking->trackingStage());

        $booking->forceFill(['status' => BookingStatus::Accepted])->save();
        $this->assertSame('confirmed', $booking->fresh()->trackingStage());

        $trip->forceFill(['status' => TripStatus::InProgress])->save();
        $this->assertSame('en_route', $booking->fresh()->trackingStage());

        $booking->forceFill(['driver_arrived_at' => now()])->save();
        $this->assertSame('arrived', $booking->fresh()->trackingStage());

        $booking->forceFill(['status' => BookingStatus::Completed])->save();
        $this->assertSame('completed', $booking->fresh()->trackingStage());
    }

    public function test_an_eta_appears_only_once_the_driver_is_sharing_a_position(): void
    {
        [$trip, $booking] = $this->ride();

        // Nothing to measure from yet.
        $this->assertNull($booking->minutesAway());

        // Roughly 2km away.
        $trip->forceFill([
            'driver_lat' => 0.3743,
            'driver_lng' => 32.6103,
            'driver_located_at' => now(),
        ])->save();

        $minutes = $booking->fresh()->minutesAway();
        $this->assertNotNull($minutes);
        $this->assertGreaterThan(0, $minutes);
        $this->assertLessThan(30, $minutes, 'Two kilometres should not read as half an hour.');
    }

    public function test_a_stale_position_produces_no_eta(): void
    {
        [$trip, $booking] = $this->ride();

        $trip->forceFill([
            'driver_lat' => 0.3743,
            'driver_lng' => 32.6103,
            'driver_located_at' => now(),
        ])->save();

        $this->travel((int) config('twogende.trips.location_freshness_minutes') + 5)->minutes();

        // Better to show nothing than a number computed from an old fix.
        $this->assertNull($booking->fresh()->minutesAway());
    }

    public function test_the_home_bar_shows_the_ride_you_are_on(): void
    {
        [, $booking] = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->getJson('/api/v1/bookings/active')
            ->assertOk()
            ->assertJsonPath('data.id', $booking->id)
            ->assertJsonPath('data.tracking.stage', 'confirmed');
    }

    public function test_an_unanswered_request_is_not_a_ride_you_are_on(): void
    {
        [, $booking] = $this->ride(['status' => BookingStatus::Pending]);
        Sanctum::actingAs($booking->passenger);

        $this->getJson('/api/v1/bookings/active')->assertOk()->assertJsonPath('data', null);
    }

    public function test_a_finished_ride_clears_the_bar(): void
    {
        [$trip, $booking] = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->getJson('/api/v1/bookings/active')->assertJsonPath('data.id', $booking->id);

        $trip->forceFill(['departure_at' => now()->subHour()])->save();
        $trip->complete();

        // The bar must not outlive the journey.
        $this->getJson('/api/v1/bookings/active')->assertOk()->assertJsonPath('data', null);
    }

    public function test_a_forgotten_trip_does_not_pin_the_bar_for_ever(): void
    {
        [$trip, $booking] = $this->ride();
        Sanctum::actingAs($booking->passenger);

        // A driver who never marks the trip complete shouldn't leave a bar on
        // somebody's home screen indefinitely.
        $trip->forceFill([
            'departure_at' => now()->subHours((int) config('twogende.trips.auto_complete_after_hours') + 2),
        ])->save();

        $this->getJson('/api/v1/bookings/active')->assertOk()->assertJsonPath('data', null);
    }

    public function test_somebody_elses_ride_is_never_returned(): void
    {
        $this->ride();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/bookings/active')->assertOk()->assertJsonPath('data', null);
    }
}
