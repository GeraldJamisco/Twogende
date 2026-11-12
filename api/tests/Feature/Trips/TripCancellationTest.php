<?php

namespace Tests\Feature\Trips;

use App\Enums\BookingStatus;
use App\Enums\MessageKind;
use App\Enums\TripCancellationReason;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The driver calling a ride off.
 *
 * The screen promises confirmed passengers are "notified immediately", so most
 * of what matters here is that somebody standing at a stage actually finds out.
 */
class TripCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_reason_is_stored_as_a_code_and_the_note_separately(): void
    {
        $trip = Trip::factory()->create();
        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/cancel", [
            'reason' => TripCancellationReason::Other->value,
            'note' => 'Roadworks on Jinja Road have closed my usual route.',
        ])->assertOk();

        $trip->refresh();

        $this->assertSame(TripStatus::Cancelled, $trip->status);
        $this->assertSame(TripCancellationReason::Other, $trip->cancellation_reason_code);
        $this->assertSame(
            'Roadworks on Jinja Road have closed my usual route.',
            $trip->cancellation_note,
        );
    }

    public function test_a_reason_has_to_be_one_of_the_offered_ones(): void
    {
        $trip = Trip::factory()->create();
        Sanctum::actingAs($trip->driver);

        // Free text used to be accepted here. It isn't countable, so it isn't
        // a reason - it belongs in the note.
        $this->postJson("/api/v1/trips/{$trip->id}/cancel", ['reason' => 'Car trouble'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/trips/{$trip->id}/cancel")
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->assertSame(TripStatus::Scheduled, $trip->fresh()->status);
    }

    public function test_everybody_riding_on_it_is_told_in_their_own_conversation(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $pending = Booking::factory()->for($trip)->create();
        $accepted = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/cancel", [
            'reason' => TripCancellationReason::VehicleProblem->value,
        ])->assertOk();

        foreach ([$pending, $accepted] as $booking) {
            $notice = $booking->messages()->where('kind', MessageKind::System)->latest('id')->first();

            $this->assertNotNull($notice, 'A cancelled passenger was never told.');
            $this->assertStringContainsString('has been cancelled', $notice->body);
            $this->assertStringContainsString('problem with the vehicle', $notice->body);

            // It has to read as Twogende speaking, not as the driver typing.
            $this->assertNull($notice->sender_id);
        }
    }

    public function test_the_passenger_is_not_shown_the_drivers_own_words(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/cancel", [
            'reason' => TripCancellationReason::PersonalEmergency->value,
            'note' => 'My mother is in hospital in Mbale.',
        ])->assertOk();

        $notice = $booking->messages()->where('kind', MessageKind::System)->latest('id')->first();

        $this->assertStringNotContainsString('Mbale', $notice->body);
        $this->assertStringNotContainsString('mother', $notice->body);
    }

    public function test_somebody_who_already_cancelled_is_not_told_twice(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();

        $gone = Booking::factory()->for($trip)->create([
            'status' => BookingStatus::CancelledByPassenger,
        ]);

        Sanctum::actingAs($trip->driver);

        $this->postJson("/api/v1/trips/{$trip->id}/cancel", [
            'reason' => TripCancellationReason::ChangedPlans->value,
        ])->assertOk();

        // They left before the driver did. Telling them their seat is gone
        // would be news about a ride they are no longer on.
        $this->assertSame(0, $gone->messages()->where('kind', MessageKind::System)->count());
    }

    public function test_the_screen_can_ask_for_the_reasons_it_offers(): void
    {
        Sanctum::actingAs(Trip::factory()->create()->driver);

        $this->getJson('/api/v1/trips/cancellation-reasons')
            ->assertOk()
            ->assertJsonPath('data.0.code', TripCancellationReason::VehicleProblem->value)
            ->assertJsonPath('data.0.label', 'Vehicle problem')
            ->assertJsonCount(count(TripCancellationReason::cases()), 'data');
    }
}
