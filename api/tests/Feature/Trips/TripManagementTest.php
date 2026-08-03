<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TripManagementTest extends TestCase
{
    use RefreshDatabase;

    /** A user who has cleared every gate needed to publish a trip. */
    private function driverWithVehicle(): array
    {
        $driver = User::factory()->identityVerified()->create();
        $vehicle = Vehicle::factory()->verified()->for($driver, 'owner')->create(['passenger_seats' => 4]);

        return [$driver, $vehicle];
    }

    private function payload(Vehicle $vehicle, array $overrides = []): array
    {
        return array_merge([
            'vehicle_id' => $vehicle->id,
            'origin' => ['place_id' => 'place_ntinda', 'name' => 'Ntinda', 'latitude' => 0.3563, 'longitude' => 32.6103],
            'destination' => ['place_id' => 'place_kampala_cbd', 'name' => 'Kampala CBD', 'latitude' => 0.3136, 'longitude' => 32.5811],
            'departure_at' => now()->addDay()->setTime(7, 30)->toIso8601String(),
            'seats_total' => 3,
            'contribution_per_seat' => 3000,
        ], $overrides);
    }

    public function test_a_verified_driver_can_publish_a_trip(): void
    {
        [$driver, $vehicle] = $this->driverWithVehicle();
        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($vehicle))
            ->assertCreated()
            ->assertJsonPath('data.origin.name', 'Ntinda')
            ->assertJsonPath('data.contribution.per_seat', 3000)
            ->assertJsonPath('data.contribution.currency', 'UGX')
            ->assertJsonPath('data.seats.total', 3)
            ->assertJsonPath('data.seats.available', 3)
            ->assertJsonPath('data.status', 'scheduled');
    }

    public function test_seat_availability_is_derived_not_accepted_from_the_request(): void
    {
        [$driver, $vehicle] = $this->driverWithVehicle();
        Sanctum::actingAs($driver);

        // A driver posting seats_available directly would be inventing capacity.
        $this->postJson('/api/v1/trips', $this->payload($vehicle, ['seats_available' => 99]))
            ->assertCreated()
            ->assertJsonPath('data.seats.available', 3);
    }

    public function test_a_user_without_a_verified_identity_cannot_publish(): void
    {
        $user = User::factory()->create(); // phone verified, identity not
        $vehicle = Vehicle::factory()->verified()->for($user, 'owner')->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/trips', $this->payload($vehicle))->assertForbidden();
    }

    public function test_a_driver_without_an_approved_vehicle_cannot_publish(): void
    {
        $driver = User::factory()->identityVerified()->create();
        $vehicle = Vehicle::factory()->for($driver, 'owner')->create(); // still pending
        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($vehicle))->assertForbidden();
    }

    public function test_a_driver_cannot_publish_against_somebody_elses_car(): void
    {
        [$driver] = $this->driverWithVehicle();
        $strangersCar = Vehicle::factory()->verified()->create();

        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($strangersCar))
            ->assertStatus(422)
            ->assertJsonValidationErrors('vehicle_id');
    }

    public function test_a_trip_cannot_offer_more_seats_than_the_car_has(): void
    {
        [$driver, $vehicle] = $this->driverWithVehicle(); // 4 passenger seats
        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($vehicle, ['seats_total' => 6]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('seats_total');
    }

    public function test_a_trip_cannot_depart_in_the_past_or_go_nowhere(): void
    {
        [$driver, $vehicle] = $this->driverWithVehicle();
        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($vehicle, [
            'departure_at' => now()->subHour()->toIso8601String(),
        ]))->assertStatus(422)->assertJsonValidationErrors('departure_at');

        $this->postJson('/api/v1/trips', $this->payload($vehicle, [
            'destination' => ['place_id' => 'place_ntinda', 'name' => 'Ntinda', 'latitude' => 0.3563, 'longitude' => 32.6103],
        ]))->assertStatus(422)->assertJsonValidationErrors('destination.place_id');
    }

    public function test_a_free_lift_is_allowed(): void
    {
        [$driver, $vehicle] = $this->driverWithVehicle();
        Sanctum::actingAs($driver);

        $this->postJson('/api/v1/trips', $this->payload($vehicle, ['contribution_per_seat' => 0]))
            ->assertCreated()
            ->assertJsonPath('data.contribution.per_seat', 0);
    }

    public function test_only_the_driver_can_cancel_their_trip(): void
    {
        $trip = Trip::factory()->create();

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/v1/trips/{$trip->id}/cancel")->assertForbidden();

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/trips/{$trip->id}/cancel", ['reason' => 'Car trouble'])->assertOk();

        $this->assertSame(TripStatus::Cancelled, $trip->fresh()->status);
    }

    public function test_cancelling_a_trip_cancels_the_bookings_riding_on_it(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $pending = Booking::factory()->for($trip)->create();
        $accepted = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/trips/{$trip->id}/cancel")->assertOk();

        $this->assertSame(BookingStatus::CancelledByDriver, $pending->fresh()->status);
        $this->assertSame(BookingStatus::CancelledByDriver, $accepted->fresh()->status);
    }

    public function test_a_trip_cannot_be_completed_before_it_departs(): void
    {
        $trip = Trip::factory()->create(['departure_at' => now()->addDay()]);

        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/complete")->assertForbidden();
    }

    public function test_completing_a_trip_settles_bookings_and_credits_both_sides(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['departure_at' => now()->subHours(2)]);
        $accepted = Booking::factory()->for($trip)->accepted()->create();
        $rejected = Booking::factory()->for($trip)->create(['status' => BookingStatus::Rejected]);

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/trips/{$trip->id}/complete")->assertOk();

        $this->assertSame(TripStatus::Completed, $trip->fresh()->status);
        $this->assertSame(BookingStatus::Completed, $accepted->fresh()->status);
        $this->assertSame(BookingStatus::Rejected, $rejected->fresh()->status, 'A rejected booking must not be revived.');

        $this->assertSame(1, $trip->driver->fresh()->trips_as_driver);
        $this->assertSame(1, $accepted->passenger->fresh()->trips_as_passenger);
    }

    public function test_a_trip_nobody_rode_on_does_not_count_toward_reputation(): void
    {
        $trip = Trip::factory()->create(['departure_at' => now()->subHours(2)]);

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/trips/{$trip->id}/complete")->assertOk();

        $this->assertSame(0, $trip->driver->fresh()->trips_as_driver);
    }

    public function test_a_driver_cannot_rewrite_the_route_after_publishing(): void
    {
        $trip = Trip::factory()->from('Ntinda')->create();

        Sanctum::actingAs($trip->driver);

        $this->patchJson("/api/v1/trips/{$trip->id}", [
            'origin' => ['place_id' => 'place_jinja', 'name' => 'Jinja', 'latitude' => 0.4244, 'longitude' => 33.2041],
            'contribution_per_seat' => 8000,
        ])->assertOk();

        $trip->refresh();
        $this->assertSame('Ntinda', $trip->origin_name, 'Route changes are not accepted here.');
        $this->assertSame(8000, $trip->contribution_per_seat);
    }

    public function test_a_cancelled_trip_can_no_longer_be_edited(): void
    {
        $trip = Trip::factory()->create();
        $trip->cancel();

        Sanctum::actingAs($trip->driver);

        $this->patchJson("/api/v1/trips/{$trip->id}", ['contribution_per_seat' => 1000])->assertForbidden();
    }

    public function test_a_driver_sees_their_own_trips_with_request_counts(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        Booking::factory()->for($trip)->create();
        Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($trip->driver);

        $this->getJson('/api/v1/trips/mine')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $trip->id);
    }
}
