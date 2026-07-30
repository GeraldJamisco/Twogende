<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The seat count is the one number two people can fight over, so it gets
 * tested at the schema level rather than trusted to controller logic.
 */
class TripSeatAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_claiming_a_seat_decrements_availability(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();

        DB::transaction(fn() => $this->assertTrue($trip->claimSeats(1)));

        $this->assertSame(2, $trip->fresh()->seats_available);
    }

    public function test_claiming_more_seats_than_remain_is_refused(): void
    {
        $trip = Trip::factory()->withSeats(2)->create();

        DB::transaction(fn() => $this->assertFalse($trip->claimSeats(3)));

        $this->assertSame(2, $trip->fresh()->seats_available, 'A refused claim must not touch the count.');
    }

    public function test_the_last_seat_can_only_be_claimed_once(): void
    {
        $trip = Trip::factory()->withSeats(1)->create();

        DB::transaction(fn() => $this->assertTrue($trip->claimSeats(1)));
        DB::transaction(fn() => $this->assertFalse($trip->claimSeats(1)));

        $this->assertSame(0, $trip->fresh()->seats_available);
    }

    // Note: claimSeats() also refuses to run outside a transaction, but that
    // guard can't be asserted here RefreshDatabase wraps every test in one.

    public function test_the_database_refuses_to_oversell_even_if_locking_is_bypassed(): void
    {
        $trip = Trip::factory()->withSeats(1)->create();

        // Simulates a code path that skipped claimSeats() entirely. The
        // unsigned column is the last line of defence.
        $this->expectException(QueryException::class);

        DB::table('trips')->where('id', $trip->id)->decrement('seats_available', 2);
    }

    public function test_releasing_seats_cannot_exceed_the_trips_capacity(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();

        DB::transaction(fn() => $trip->claimSeats(1));
        $trip->releaseSeats(2); // one more than was ever taken

        $this->assertSame(3, $trip->fresh()->seats_available);
    }

    public function test_seats_taken_counts_only_bookings_that_hold_a_seat(): void
    {
        $trip = Trip::factory()->withSeats(4)->create();

        Booking::factory()->for($trip)->accepted()->create(['seats' => 2]);
        Booking::factory()->for($trip)->create(['seats' => 1]); // still pending

        $this->assertSame(2, $trip->seatsTaken());
    }

    public function test_a_passenger_cannot_hold_two_bookings_on_one_trip(): void
    {
        $trip = Trip::factory()->withSeats(4)->create();
        $passenger = User::factory()->create();

        Booking::factory()->for($trip)->for($passenger, 'passenger')->create();

        $this->expectException(QueryException::class);

        Booking::factory()->for($trip)->for($passenger, 'passenger')->create();
    }
}
