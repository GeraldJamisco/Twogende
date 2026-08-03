<?php

namespace Tests\Feature\Trips;

use App\Enums\MessageKind;
use App\Models\Booking;
use App\Models\Message;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Your driver is here" — generated when a driver's reported position gets
 * close enough to where a passenger is waiting.
 */
class ArrivalTest extends TestCase
{
    use RefreshDatabase;

    /** Ntinda, and a point roughly 60m away. */
    private const PICKUP = ['lat' => 0.3563, 'lng' => 32.6103];

    private const NEARBY = ['lat' => 0.35635, 'lng' => 32.61085];

    private const FAR = ['lat' => 0.4244, 'lng' => 33.2041]; // Jinja

    /** @return array{0: Trip, 1: Booking} */
    private function tripWithConfirmedPassenger(): array
    {
        $trip = Trip::factory()->withSeats(3)->create([
            'origin_lat' => self::PICKUP['lat'],
            'origin_lng' => self::PICKUP['lng'],
        ]);

        $booking = Booking::factory()->for($trip)->accepted()->create([
            'pickup_lat' => self::PICKUP['lat'],
            'pickup_lng' => self::PICKUP['lng'],
            'pickup_name' => 'Ntinda stage',
        ]);

        return [$trip, $booking];
    }

    private function report(Trip $trip, array $point): TestResponse
    {
        return $this->postJson("/api/v1/trips/{$trip->id}/location", [
            'latitude' => $point['lat'],
            'longitude' => $point['lng'],
        ]);
    }

    public function test_arriving_near_the_pickup_point_announces_it(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();
        Sanctum::actingAs($trip->driver);

        $this->report($trip, self::NEARBY)
            ->assertOk()
            ->assertJsonPath('arrivals_announced', 1);

        $message = Message::query()->where('booking_id', $booking->id)->sole();
        $this->assertSame(MessageKind::System, $message->kind);
        $this->assertNull($message->sender_id, 'A system notice comes from nobody.');
        $this->assertStringContainsString('is here', $message->body);
        $this->assertNotNull($booking->fresh()->driver_arrived_at);
    }

    public function test_the_notice_names_the_plate_the_passenger_should_look_for(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();
        $trip->vehicle->forceFill(['plate_last4' => '402K'])->save();

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertOk();

        $this->assertStringContainsString(
            '402K',
            Message::query()->where('booking_id', $booking->id)->sole()->body,
        );
    }

    public function test_being_far_away_announces_nothing(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();
        Sanctum::actingAs($trip->driver);

        $this->report($trip, self::FAR)
            ->assertOk()
            ->assertJsonPath('arrivals_announced', 0);

        $this->assertSame(0, Message::query()->count());
        $this->assertNull($booking->fresh()->driver_arrived_at);
    }

    public function test_an_arrival_is_announced_only_once(): void
    {
        [$trip] = $this->tripWithConfirmedPassenger();
        Sanctum::actingAs($trip->driver);

        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 1);

        // A driver waiting at the stage keeps reporting; the passenger should
        // not get the same notice over and over.
        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 0);
        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 0);

        $this->assertSame(1, Message::query()->count());
    }

    public function test_a_passenger_who_is_not_confirmed_gets_no_notice(): void
    {
        $trip = Trip::factory()->withSeats(3)->create([
            'origin_lat' => self::PICKUP['lat'],
            'origin_lng' => self::PICKUP['lng'],
        ]);
        // Still pending — the driver hasn't agreed to carry them.
        Booking::factory()->for($trip)->create([
            'pickup_lat' => self::PICKUP['lat'],
            'pickup_lng' => self::PICKUP['lng'],
        ]);

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 0);
    }

    public function test_a_shared_live_position_is_preferred_over_the_pickup_point(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();

        // The passenger has walked to Jinja — absurd, but it proves the live
        // position wins over the stated pickup point.
        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/location", [
            'latitude' => self::FAR['lat'],
            'longitude' => self::FAR['lng'],
        ])->assertOk();

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 0);
    }

    public function test_a_stale_live_position_falls_back_to_the_pickup_point(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();

        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/location", [
            'latitude' => self::FAR['lat'],
            'longitude' => self::FAR['lng'],
        ])->assertOk();

        // An old fix is worse than the place they said they'd wait.
        $this->travel((int) config('twogende.trips.location_freshness_minutes') + 5)->minutes();

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertJsonPath('arrivals_announced', 1);
    }

    public function test_only_the_driver_may_report_the_trips_position(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();

        Sanctum::actingAs($booking->passenger);
        $this->report($trip, self::NEARBY)->assertForbidden();

        Sanctum::actingAs(User::factory()->create());
        $this->report($trip, self::NEARBY)->assertForbidden();
    }

    public function test_a_stranger_cannot_report_a_passengers_position(): void
    {
        [, $booking] = $this->tripWithConfirmedPassenger();

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/v1/bookings/{$booking->id}/location", [
            'latitude' => self::NEARBY['lat'],
            'longitude' => self::NEARBY['lng'],
        ])->assertForbidden();
    }

    public function test_positions_are_never_readable_by_anyone(): void
    {
        [$trip, $booking] = $this->tripWithConfirmedPassenger();

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertOk();

        // The passenger sees the notice, never the coordinates behind it.
        Sanctum::actingAs($booking->passenger);
        $response = $this->getJson("/api/v1/trips/{$trip->id}")->assertOk();

        $response->assertJsonMissingPath('data.driver_lat');
        $this->assertStringNotContainsString('driver_lat', $response->getContent());
        $this->assertStringNotContainsString((string) self::NEARBY['lat'], $response->getContent());
    }

    public function test_a_finished_trip_stops_accepting_positions(): void
    {
        [$trip] = $this->tripWithConfirmedPassenger();
        $trip->forceFill(['departure_at' => now()->subHours(2)])->save();
        $trip->complete();

        Sanctum::actingAs($trip->driver);
        $this->report($trip, self::NEARBY)->assertStatus(422);
    }
}
