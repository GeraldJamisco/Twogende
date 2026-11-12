<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\MessageKind;
use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The settings screen's two switches, and closing an account.
 *
 * Deleting is the one action here that touches other people: a driver who
 * leaves must not strand the passengers who booked their ride.
 */
class AccountSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketing_consent_is_off_until_it_is_given(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/me')
            ->assertOk()
            // Ride updates are what a booking is useless without.
            ->assertJsonPath('data.notifications.ride_updates', true)
            // Consent is given, never assumed.
            ->assertJsonPath('data.notifications.marketing', false);

        $this->patchJson('/api/v1/me/notifications', ['notify_marketing' => true])
            ->assertOk()
            ->assertJsonPath('data.notifications.marketing', true);

        $this->patchJson('/api/v1/me/notifications', ['notify_ride_updates' => false])
            ->assertOk()
            ->assertJsonPath('data.notifications.ride_updates', false)
            // One switch does not move the other.
            ->assertJsonPath('data.notifications.marketing', true);
    }

    public function test_closing_an_account_cancels_the_rides_it_was_driving(): void
    {
        $driver = User::factory()->identityVerified()->create();
        $trip = Trip::factory()->withSeats(3)->for($driver, 'driver')->create();
        $booking = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($driver);

        $this->deleteJson('/api/v1/me', ['reason' => 'Privacy concerns'])
            ->assertOk();

        $this->assertSame(TripStatus::Cancelled, $trip->fresh()->status);
        $this->assertSame(BookingStatus::CancelledByDriver, $booking->fresh()->status);

        // And the passenger was actually told, in the conversation they have.
        $this->assertSame(
            1,
            $booking->messages()->where('kind', MessageKind::System)->count(),
            'A passenger was left waiting for a driver who deleted their account.',
        );
    }

    public function test_closing_an_account_releases_the_seats_it_was_holding(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->accepted()->create();

        Sanctum::actingAs($booking->passenger);
        $this->deleteJson('/api/v1/me')->assertOk();

        $this->assertSame(BookingStatus::CancelledByPassenger, $booking->fresh()->status);
    }

    public function test_closing_an_account_ends_every_session_not_just_this_one(): void
    {
        $user = User::factory()->create();

        // A second device, still signed in.
        $other = $user->createToken('other-phone')->plainTextToken;

        Sanctum::actingAs($user);
        $this->deleteJson('/api/v1/me')->assertOk();

        $this->assertSame(0, $user->tokens()->count());

        /*
         * The guard resolved by actingAs() is cached on the test application
         * and would answer the next request from memory, so a revoked token
         * would look like it still worked. Forget it and make the request
         * prove itself against the database.
         */
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$other}")
            ->getJson('/api/v1/me')
            ->assertUnauthorized();
    }

    public function test_the_reason_is_kept_and_the_row_is_not_erased(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->deleteJson('/api/v1/me', ['reason' => 'I had a bad experience'])->assertOk();

        $row = User::withTrashed()->find($user->id);

        // Soft-deleted: a completed trip has two sides, and erasing the row
        // would take the other person's history with it.
        $this->assertNotNull($row);
        $this->assertNotNull($row->deleted_at);
        $this->assertSame('I had a bad experience', $row->deletion_reason);
    }

    public function test_a_signed_out_visitor_cannot_close_somebody_elses_account(): void
    {
        $user = User::factory()->create();

        $this->deleteJson('/api/v1/me')->assertUnauthorized();

        $this->assertNull(User::find($user->id)->deleted_at);
    }
}
