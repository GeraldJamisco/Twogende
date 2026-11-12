<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\MobileMoneyGateway;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\PublicUserResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

/**
 * Settling a booking's contribution.
 *
 * Twogende does not hold anybody's money. Cash goes from a passenger's hand to
 * a driver's and this only writes down that it did; mobile money goes straight
 * to the driver's own wallet through an aggregator. There is no float, no
 * escrow and no balance - which is also why the 20% commission is, for now,
 * only ever shown and never collected.
 */
class PaymentController extends Controller
{
    /**
     * What is owed, and which methods can actually take it.
     *
     * Availability is asked of the gateway rather than assumed from the list
     * of methods that exist. Offering MTN and failing at the last step is
     * worse than saying up front that it isn't connected.
     */
    public function show(Request $request, Booking $booking, MobileMoneyGateway $gateway): JsonResponse
    {
        $this->authorize('view', $booking);

        $payment = $this->settledOrLatest($booking);

        return response()->json([
            'data' => [
                'booking_id' => $booking->id,

                // The trip card at the top of the screen. Read from the trip
                // rather than passed in, so it can't disagree with the ride.
                'route' => [
                    'origin' => $booking->trip->origin_name,
                    'destination' => $booking->trip->destination_name,
                ],
                'departure_at' => $booking->trip->departure_at?->toIso8601String(),

                'amount' => $booking->total_contribution,
                'currency' => $booking->currency,
                'driver' => new PublicUserResource($booking->trip->driver),

                'methods' => collect(PaymentMethod::cases())
                    ->map(fn (PaymentMethod $method) => [
                        'method' => $method->value,
                        'label' => $method->label(),
                        'note' => $method->note(),
                        'provider' => $method->provider(),

                        // Cash needs nothing but two people at a destination.
                        'available' => ! $method->isMobileMoney()
                            || $gateway->isAvailable($method),
                    ])
                    ->values(),

                /*
                 * The number a request would be sent to, so the sheet can show
                 * it without the passenger typing their own number back at us.
                 * They can still override it - the design allows paying from a
                 * different handset.
                 */
                'default_phone' => $request->user()->phone,

                'payment' => $payment ? new PaymentResource($payment) : null,
                'settled' => $payment?->status->isSettled() ?? false,
            ],
        ]);
    }

    /**
     * Choose a method and settle, or start trying to.
     *
     * Cash completes here: there is nothing to wait for, and the passenger
     * pressing the button is the only signal that exists. Mobile money leaves
     * a record awaiting approval and pushes a request to their handset - the
     * answer arrives later, out of band.
     */
    public function store(Request $request, Booking $booking, MobileMoneyGateway $gateway): JsonResponse
    {
        // Only the passenger settles. A driver marking their own contribution
        // paid is not a signal anyone should trust.
        $this->authorize('pay', $booking);

        $validated = $request->validate([
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'phone' => ['nullable', 'string'],
        ]);

        $method = PaymentMethod::from($validated['method']);

        if ($this->settledOrLatest($booking)?->status->isSettled()) {
            return response()->json([
                'message' => 'This ride has already been paid for.',
            ], 422);
        }

        if ($method->isMobileMoney() && ! $gateway->isAvailable($method)) {
            /*
             * 503, not 422: nothing the passenger did is wrong, and the same
             * request will succeed unchanged once an aggregator is connected.
             */
            return response()->json([
                'message' => $method->label().' is not connected yet. Pay the driver in cash for now.',
                'reason' => 'gateway_unavailable',
            ], 503);
        }

        $phone = $method->isMobileMoney()
            ? $this->resolvePhone($validated['phone'] ?? null, $request->user()->phone)
            : null;

        $payment = new Payment;
        $payment->forceFill([
            'booking_id' => $booking->getKey(),
            'payer_id' => $request->user()->getKey(),
            'payee_id' => $booking->trip->driver_id,
            'method' => $method->value,
            'status' => PaymentStatus::Pending->value,
            'amount' => $booking->total_contribution,
            'currency' => $booking->currency,
            'reference' => Payment::generateReference(),
            'payer_phone' => $phone,
        ])->save();

        if (! $method->isMobileMoney()) {
            // The passenger says they handed the money over. That assertion is
            // the whole of the evidence, and the record says so by carrying
            // the method that produced it.
            $payment->markCompleted();

            return $this->respond($payment, 201);
        }

        try {
            $providerReference = $gateway->requestApproval($payment);
        } catch (RuntimeException|Throwable $e) {
            $payment->markFailed($e->getMessage());

            return response()->json([
                'message' => 'Could not reach '.$method->label().'. Nothing has been charged.',
                'reason' => 'request_failed',
                'data' => new PaymentResource($payment),
            ], 502);
        }

        $payment->forceFill([
            'status' => PaymentStatus::AwaitingApproval->value,
            'provider_reference' => $providerReference,
            'requested_at' => now(),
        ])->save();

        return $this->respond($payment, 201);
    }

    /**
     * The passenger tapping "I approved it".
     *
     * It does *not* mark the payment complete. Only the provider can say money
     * moved, and a person tapping a button in an app is not the provider - * treating it as one would let anybody mark a ride paid for free. All this
     * does is re-read the record, so a callback that has already landed shows
     * up immediately instead of on the next poll.
     */
    public function status(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('view', $payment->booking);

        return $this->respond($payment->refresh(), 200);
    }

    private function respond(Payment $payment, int $status): JsonResponse
    {
        return response()->json([
            'data' => new PaymentResource($payment),
            'settled' => $payment->status->isSettled(),
        ], $status);
    }

    /** A settled payment beats an unsettled one, whatever order they arrived in. */
    private function settledOrLatest(Booking $booking): ?Payment
    {
        return $booking->payments()
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [PaymentStatus::Completed->value])
            ->latest('id')
            ->first();
    }

    private function resolvePhone(?string $given, string $fallback): string
    {
        if ($given === null || trim($given) === '') {
            return $fallback;
        }

        $normalised = PhoneNumber::normalise($given);

        if ($normalised === null) {
            throw ValidationException::withMessages([
                'phone' => 'That does not look like a Ugandan mobile number.',
            ]);
        }

        return $normalised;
    }
}
