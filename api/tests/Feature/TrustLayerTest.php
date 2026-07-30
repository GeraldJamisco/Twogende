<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\RatedRole;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrustLayerTest extends TestCase
{
    use RefreshDatabase;

    public function test_driving_requires_phone_identity_and_a_verified_vehicle(): void
    {
        $unverifiedPhone = User::factory()->unverified()->identityVerified()->create();
        Vehicle::factory()->verified()->for($unverifiedPhone, 'owner')->create();
        $this->assertFalse($unverifiedPhone->canDrive(), 'Unverified phone must block driving.');

        $noIdentity = User::factory()->create();
        Vehicle::factory()->verified()->for($noIdentity, 'owner')->create();
        $this->assertFalse($noIdentity->canDrive(), 'Unverified identity must block driving.');

        $unverifiedVehicle = User::factory()->identityVerified()->create();
        Vehicle::factory()->for($unverifiedVehicle, 'owner')->create(); // pending review
        $this->assertFalse($unverifiedVehicle->canDrive(), 'A pending vehicle must block driving.');

        $ready = User::factory()->identityVerified()->create();
        Vehicle::factory()->verified()->for($ready, 'owner')->create();
        $this->assertTrue($ready->canDrive());
    }

    public function test_a_plate_number_cannot_be_registered_twice(): void
    {
        Vehicle::factory()->create(['plate_number' => 'UAX 123B']);

        $this->expectException(QueryException::class);

        Vehicle::factory()->create(['plate_number' => 'UAX 123B']);
    }

    public function test_a_phone_number_cannot_be_registered_twice(): void
    {
        User::factory()->create(['phone' => '+256701234567']);

        $this->expectException(QueryException::class);

        User::factory()->create(['phone' => '+256701234567']);
    }

    public function test_contact_details_are_withheld_until_the_driver_accepts(): void
    {
        $pending = Booking::factory()->create();
        $this->assertFalse($pending->allowsContactExchange());

        $accepted = Booking::factory()->accepted()->create();
        $this->assertTrue($accepted->allowsContactExchange());
    }

    public function test_each_side_of_a_completed_trip_owes_the_other_a_rating(): void
    {
        $booking = Booking::factory()->accepted()->create();
        $driver = $booking->trip->driver;
        $passenger = $booking->passenger;

        // Nothing is owed until the trip is actually done.
        $this->assertNull($booking->pendingRatingRoleFor($passenger));

        // forceFill because status is intentionally not mass-assignable it
        // only ever moves through the booking state machine.
        $booking->forceFill(['status' => BookingStatus::Completed, 'completed_at' => now()])->save();
        $booking->refresh();

        $this->assertSame(RatedRole::Driver, $booking->pendingRatingRoleFor($passenger));
        $this->assertSame(RatedRole::Passenger, $booking->pendingRatingRoleFor($driver));

        // A stranger is owed nothing.
        $this->assertNull($booking->pendingRatingRoleFor(User::factory()->create()));
    }

    public function test_a_rating_can_only_be_left_once_per_booking(): void
    {
        $booking = Booking::factory()->create();
        $passenger = $booking->passenger;

        // forceCreate: who rated whom is set by the server, never by request
        // input, so those columns are not mass-assignable.
        $booking->ratings()->forceCreate([
            'rater_id' => $passenger->id,
            'ratee_id' => $booking->trip->driver_id,
            'ratee_role' => RatedRole::Driver,
            'stars' => 5,
        ]);

        $this->expectException(QueryException::class);

        $booking->ratings()->forceCreate([
            'rater_id' => $passenger->id,
            'ratee_id' => $booking->trip->driver_id,
            'ratee_role' => RatedRole::Driver,
            'stars' => 1,
        ]);
    }

    public function test_search_only_surfaces_trips_that_can_still_be_booked(): void
    {
        $bookable = Trip::factory()->withSeats(2)->create();
        $full = Trip::factory()->withSeats(0)->create();
        $departed = Trip::factory()->withSeats(2)->create(['departure_at' => now()->subHour()]);
        $cancelled = Trip::factory()->withSeats(2)->create(['status' => TripStatus::Cancelled]);

        $results = Trip::query()->bookable()->pluck('id');

        $this->assertContains($bookable->id, $results);
        $this->assertNotContains($full->id, $results);
        $this->assertNotContains($departed->id, $results);
        $this->assertNotContains($cancelled->id, $results);
    }
}
