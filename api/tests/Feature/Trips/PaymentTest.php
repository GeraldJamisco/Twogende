<?php

namespace Tests\Feature\Trips;

use App\Contracts\MobileMoneyGateway;
use App\Enums\BookingStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeMobileMoneyGateway;
use Tests\TestCase;

/**
 * Settling a booking's contribution.
 *
 * The thing most worth protecting here is that a payment record never claims
 * money moved when it didn't. Cash is an assertion by the passenger and says
 * so; mobile money is only ever completed by the provider.
 */
class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private function ride(int $contribution = 15_000): Booking
    {
        $trip = Trip::factory()->withSeats(3)->create([
            'departure_at' => now()->subHour(),
            'contribution_per_seat' => $contribution,
        ]);

        return Booking::factory()->for($trip)->create([
            'status' => BookingStatus::Accepted,
            'seats' => 1,
            'contribution_per_seat' => $contribution,
            'total_contribution' => $contribution,
        ]);
    }

    public function test_cash_settles_immediately_and_gets_a_reference(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $response = $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Cash->value,
        ])->assertCreated()
            ->assertJsonPath('settled', true)
            ->assertJsonPath('data.status', PaymentStatus::Completed->value)
            ->assertJsonPath('data.amount', 15_000);

        // "TWG-8H2K41" - short enough to read down a phone line.
        $this->assertMatchesRegularExpression(
            '/^TWG-[2-9A-HJ-NP-Z]{6}$/',
            $response->json('data.reference'),
        );

        $this->assertTrue($booking->fresh()->isSettled());
    }

    public function test_mobile_money_is_offered_only_when_a_gateway_can_take_it(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        // Nothing is connected, which is today's reality.
        $methods = collect(
            $this->getJson("/api/v1/bookings/{$booking->id}/payment")
                ->assertOk()
                ->json('data.methods')
        )->keyBy('method');

        $this->assertTrue($methods['cash']['available']);
        $this->assertFalse($methods['mtn']['available']);
        $this->assertFalse($methods['airtel']['available']);

        $this->app->instance(MobileMoneyGateway::class, new FakeMobileMoneyGateway);

        $methods = collect(
            $this->getJson("/api/v1/bookings/{$booking->id}/payment")->json('data.methods')
        )->keyBy('method');

        $this->assertTrue($methods['mtn']['available']);
    }

    public function test_choosing_an_unconnected_provider_charges_nothing(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Mtn->value,
        ])->assertStatus(503)
            ->assertJsonPath('reason', 'gateway_unavailable');

        // No half-written record claiming a payment that was never asked for.
        $this->assertSame(0, $booking->payments()->count());
        $this->assertFalse($booking->fresh()->isSettled());
    }

    public function test_mobile_money_waits_for_the_provider_rather_than_the_passenger(): void
    {
        $gateway = new FakeMobileMoneyGateway;
        $this->app->instance(MobileMoneyGateway::class, $gateway);

        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $payment = $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Mtn->value,
        ])->assertCreated()
            ->assertJsonPath('settled', false)
            ->assertJsonPath('data.status', PaymentStatus::AwaitingApproval->value)
            ->json('data');

        $this->assertCount(1, $gateway->requested);
        $this->assertSame($booking->passenger->phone, $payment['payer_phone']);

        /*
         * "I approved it" must not settle anything. If tapping a button in the
         * app completed a payment, every ride in Uganda would be free.
         */
        $this->getJson("/api/v1/payments/{$payment['id']}")
            ->assertOk()
            ->assertJsonPath('settled', false)
            ->assertJsonPath('data.status', PaymentStatus::AwaitingApproval->value);

        $this->assertFalse($booking->fresh()->isSettled());

        // Only the provider's word settles it.
        Payment::find($payment['id'])->markCompleted('MTN-993301');

        $this->getJson("/api/v1/payments/{$payment['id']}")
            ->assertOk()
            ->assertJsonPath('settled', true);
    }

    public function test_a_request_that_never_reached_the_provider_is_recorded_as_failed(): void
    {
        $this->app->instance(
            MobileMoneyGateway::class,
            new FakeMobileMoneyGateway(available: true, throwOnRequest: true),
        );

        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Airtel->value,
        ])->assertStatus(502)
            ->assertJsonPath('data.status', PaymentStatus::Failed->value);

        $this->assertFalse($booking->fresh()->isSettled());
    }

    public function test_a_passenger_can_pay_from_a_different_handset(): void
    {
        $this->app->instance(MobileMoneyGateway::class, new FakeMobileMoneyGateway);

        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Mtn->value,
            'phone' => '0772 123 456',
        ])->assertCreated()
            ->assertJsonPath('data.payer_phone', '+256772123456');
    }

    public function test_a_number_that_is_not_a_number_is_refused(): void
    {
        $this->app->instance(MobileMoneyGateway::class, new FakeMobileMoneyGateway);

        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Mtn->value,
            'phone' => 'not a phone',
        ])->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->assertSame(0, $booking->payments()->count());
    }

    public function test_the_driver_cannot_mark_their_own_ride_paid(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs($booking->trip->driver);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Cash->value,
        ])->assertForbidden();

        $this->assertFalse($booking->fresh()->isSettled());
    }

    public function test_a_stranger_sees_none_of_it(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/bookings/{$booking->id}/payment")->assertForbidden();
    }

    public function test_a_ride_cannot_be_paid_for_twice(): void
    {
        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Cash->value,
        ])->assertCreated();

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Cash->value,
        ])->assertStatus(422);

        $this->assertSame(1, $booking->payments()->count());
    }

    public function test_a_failed_attempt_does_not_block_a_second_try(): void
    {
        $this->app->instance(
            MobileMoneyGateway::class,
            new FakeMobileMoneyGateway(available: true, throwOnRequest: true),
        );

        $booking = $this->ride();
        Sanctum::actingAs($booking->passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Mtn->value,
        ])->assertStatus(502);

        // Their MTN request timed out; they hand over cash instead.
        $this->postJson("/api/v1/bookings/{$booking->id}/payment", [
            'method' => PaymentMethod::Cash->value,
        ])->assertCreated();

        $this->assertTrue($booking->fresh()->isSettled());

        // The failed attempt is still on the record - two facts, not one.
        $this->assertSame(2, $booking->payments()->count());
    }

    public function test_the_screen_is_told_what_is_owed_and_to_whom(): void
    {
        $booking = $this->ride(20_000);
        Sanctum::actingAs($booking->passenger);

        $this->getJson("/api/v1/bookings/{$booking->id}/payment")
            ->assertOk()
            ->assertJsonPath('data.amount', 20_000)
            ->assertJsonPath('data.currency', 'UGX')
            ->assertJsonPath('data.settled', false)
            ->assertJsonPath('data.driver.id', $booking->trip->driver_id)
            // The driver's own number must not ride along on a payment screen.
            ->assertJsonMissingPath('data.driver.phone');
    }
}
