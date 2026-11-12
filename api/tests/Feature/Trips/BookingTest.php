<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Requesting a seat, and the driver answering - the flow behind
 * "Twogende Ride Posted.dc.html".
 */
class BookingTest extends TestCase
{
    use RefreshDatabase;

    // Requesting

    public function test_a_passenger_can_request_a_seat(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['contribution_per_seat' => 15000]);
        $passenger = User::factory()->create();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/trips/{$trip->id}/bookings", [
            'seats' => 2,
            'pickup' => [
                'place_id' => 'place_kireka',
                'name' => 'Kireka stage',
                'latitude' => 0.3444,
                'longitude' => 32.6547,
            ],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.seats', 2)
            ->assertJsonPath('data.pickup.name', 'Kireka stage')
            ->assertJsonPath('data.contribution.total', 30000);
    }

    public function test_the_contribution_is_snapshotted_at_request_time(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['contribution_per_seat' => 15000]);
        $passenger = User::factory()->create();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/trips/{$trip->id}/bookings", ['seats' => 1])->assertCreated();

        // The driver raising their price must not move what somebody already
        // agreed to.
        $trip->update(['contribution_per_seat' => 40000]);

        $this->assertSame(15000, Booking::query()->sole()->contribution_per_seat);
    }

    public function test_a_driver_cannot_book_their_own_trip(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/bookings")->assertStatus(422);
    }

    public function test_a_seat_cannot_be_requested_twice(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $passenger = User::factory()->create();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/trips/{$trip->id}/bookings")->assertCreated();
        $this->postJson("/api/v1/trips/{$trip->id}/bookings")->assertStatus(409);

        $this->assertSame(1, Booking::query()->count());
    }

    public function test_requesting_again_after_cancelling_revives_the_same_row(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $passenger = User::factory()->create();
        Sanctum::actingAs($passenger);

        $booking = Booking::factory()->for($trip)->for($passenger, 'passenger')->create();
        $this->postJson("/api/v1/bookings/{$booking->id}/cancel")->assertOk();

        $this->postJson("/api/v1/trips/{$trip->id}/bookings")->assertCreated();

        // One row per passenger per trip keeps the seat maths unambiguous.
        $this->assertSame(1, Booking::query()->count());
        $this->assertSame(BookingStatus::Pending, Booking::query()->sole()->status);
    }

    public function test_more_seats_than_remain_cannot_be_requested(): void
    {
        $trip = Trip::factory()->withSeats(1)->create();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/trips/{$trip->id}/bookings", ['seats' => 3])->assertStatus(422);
    }

    // Responding

    public function test_accepting_takes_the_seats(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create(['seats' => 2]);

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/bookings/{$booking->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertSame(1, $trip->fresh()->seats_available);
    }

    public function test_the_last_seat_cannot_be_given_to_two_people(): void
    {
        $trip = Trip::factory()->withSeats(1)->create();
        $first = Booking::factory()->for($trip)->create(['seats' => 1]);
        $second = Booking::factory()->for($trip)->create(['seats' => 1]);

        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/bookings/{$first->id}/accept")->assertOk();
        // The seat is gone; the second accept must fail rather than oversell.
        $this->postJson("/api/v1/bookings/{$second->id}/accept")->assertStatus(409);

        $this->assertSame(0, $trip->fresh()->seats_available);
        $this->assertSame(BookingStatus::Pending, $second->fresh()->status);
    }

    public function test_declining_leaves_the_seats_alone(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create(['seats' => 2]);

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/bookings/{$booking->id}/reject", ['reason' => 'Full already'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame(3, $trip->fresh()->seats_available);
    }

    public function test_only_the_driver_can_answer_a_request(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/accept")->assertForbidden();

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/v1/bookings/{$booking->id}/accept")->assertForbidden();
    }

    public function test_an_answered_request_cannot_be_answered_again(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($trip->driver);

        // Otherwise accepting twice would take the seats twice.
        $this->postJson("/api/v1/bookings/{$booking->id}/accept")->assertForbidden();
        $this->postJson("/api/v1/bookings/{$booking->id}/reject")->assertForbidden();
    }

    public function test_cancelling_an_accepted_booking_gives_the_seats_back(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->accepted()->create(['seats' => 2]);
        $trip->forceFill(['seats_available' => 1])->save();

        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled_by_passenger');

        $this->assertSame(3, $trip->fresh()->seats_available);
    }

    public function test_who_cancelled_is_recorded(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs($trip->driver);
        $this->postJson("/api/v1/bookings/{$booking->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled_by_driver');
    }

    // The driver's list

    public function test_the_driver_sees_requests_with_pending_ones_first(): void
    {
        $trip = Trip::factory()->withSeats(4)->create();
        Booking::factory()->for($trip)->accepted()->create();
        Booking::factory()->for($trip)->create();

        Sanctum::actingAs($trip->driver);

        $statuses = $this->getJson("/api/v1/trips/{$trip->id}/bookings")
            ->assertOk()
            ->json('data.*.status');

        $this->assertSame('pending', $statuses[0]);
    }

    public function test_a_stranger_cannot_read_a_trips_requests(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        Booking::factory()->for($trip)->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/trips/{$trip->id}/bookings")->assertForbidden();
    }

    public function test_a_request_never_exposes_the_passengers_phone(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs($trip->driver);
        $response = $this->getJson("/api/v1/trips/{$trip->id}/bookings")->assertOk();

        // Contact details are released only once the request is accepted, and
        // through their own endpoint.
        $this->assertStringNotContainsString($booking->passenger->phone, $response->getContent());
        $response->assertJsonMissingPath('data.0.passenger.phone');
    }
}
