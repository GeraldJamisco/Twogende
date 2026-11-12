<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Trip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    /**
     * Requests on one of the driver's trips - pending first, since those are
     * the ones needing an answer.
     */
    public function forTrip(Request $request, Trip $trip): AnonymousResourceCollection
    {
        $this->authorize('manageBookings', $trip);

        $bookings = $trip->bookings()
            ->with('passenger')
            // Pending first - those are the ones waiting on an answer. Spelled
            // out rather than using FIELD(), whose ranking reads backwards.
            ->orderByRaw("CASE status
                WHEN 'pending' THEN 0
                WHEN 'accepted' THEN 1
                WHEN 'completed' THEN 2
                ELSE 3 END")
            ->orderBy('created_at')
            ->get();

        return BookingResource::collection($bookings);
    }

    /** The signed-in passenger's own bookings. */
    public function index(Request $request): AnonymousResourceCollection
    {
        return BookingResource::collection(
            Booking::query()
                ->where('passenger_id', $request->user()->getKey())
                ->with(['passenger', 'trip'])
                ->latest('id')
                ->get()
        );
    }

    /**
     * The ride this passenger is currently on, if any.
     *
     * Backs the bar that sits on the home screen for the whole of a journey.
     * "Current" means confirmed and not yet finished - a request nobody has
     * answered isn't a ride you're on, and a completed one is over.
     */
    public function active(Request $request): JsonResponse
    {
        $booking = Booking::query()
            ->where('passenger_id', $request->user()->getKey())
            ->where('status', BookingStatus::Accepted)
            ->whereHas('trip', fn ($trip) => $trip
                ->whereIn('status', [TripStatus::Scheduled, TripStatus::InProgress])
                // Stops a forgotten trip from pinning a bar to the home screen
                // for ever.
                ->where('departure_at', '>', now()->subHours((int) config('twogende.trips.auto_complete_after_hours')))
            )
            ->with(['passenger', 'trip.driver', 'trip.vehicle'])
            ->orderBy('id')
            ->first();

        return response()->json([
            'data' => $booking ? new BookingResource($booking) : null,
        ]);
    }

    /**
     * One booking, with everything the chat header and the confirmation
     * screen need - driver, vehicle, route and the chat window.
     */
    public function show(Request $request, Booking $booking): BookingResource
    {
        $this->authorize('view', $booking);

        return new BookingResource(
            $booking->load(['passenger', 'trip.driver', 'trip.vehicle'])
        );
    }

    /**
     * Request a seat.
     *
     * The contribution is snapshotted here: the driver can edit the trip's
     * price afterwards, and what the passenger agreed to must not move under
     * them.
     */
    public function store(StoreBookingRequest $request, Trip $trip): JsonResponse
    {
        $user = $request->user();

        if ($trip->driver_id === $user->getKey()) {
            return response()->json(['message' => 'You cannot book a seat on your own trip.'], 422);
        }

        if (! $trip->status->acceptsBookings() || $trip->departure_at->isPast()) {
            return response()->json(['message' => 'This trip is no longer taking requests.'], 422);
        }

        $seats = $request->integer('seats', 1);

        if ($trip->seats_available < $seats) {
            return response()->json(['message' => 'There are not enough seats left on this trip.'], 422);
        }

        /*
         * One row per passenger per trip for the life of the trip - the unique
         * constraint says so. Re-requesting after a cancellation revives the
         * existing row rather than inserting a second one, which keeps the
         * seat maths unambiguous.
         */
        $booking = Booking::query()
            ->where('trip_id', $trip->getKey())
            ->where('passenger_id', $user->getKey())
            ->first() ?? new Booking;

        if ($booking->exists && ! $booking->status->isTerminal()) {
            return response()->json(['message' => 'You have already requested a seat on this trip.'], 409);
        }

        $booking->forceFill([
            'trip_id' => $trip->getKey(),
            'passenger_id' => $user->getKey(),
            'seats' => $seats,
            'pickup_place_id' => $request->input('pickup.place_id'),
            'pickup_name' => $request->input('pickup.name'),
            'pickup_lat' => $request->input('pickup.latitude'),
            'pickup_lng' => $request->input('pickup.longitude'),
            'contribution_per_seat' => $trip->contribution_per_seat,
            'total_contribution' => $trip->contribution_per_seat * $seats,
            'currency' => $trip->currency,
            'status' => BookingStatus::Pending,
            'message' => $request->input('message'),
            'responded_at' => null,
            'rejection_reason' => null,
            'cancelled_at' => null,
        ])->save();

        return (new BookingResource($booking->load('passenger')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Accept a request.
     *
     * This is the one place two passengers can genuinely race - both tapping
     * accept on the last seat. Trip::claimSeats() locks the row for the
     * check-and-decrement, and the whole thing commits together so a booking
     * can never be accepted without its seat being taken.
     */
    public function accept(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('respond', $booking);

        $accepted = DB::transaction(function () use ($booking) {
            if (! $booking->trip->claimSeats($booking->seats)) {
                return false;
            }

            $booking->forceFill([
                'status' => BookingStatus::Accepted,
                'responded_at' => now(),
            ])->save();

            return true;
        });

        if (! $accepted) {
            return response()->json([
                'message' => 'There are no longer enough seats to accept this request.',
            ], 409);
        }

        return response()->json([
            'message' => 'Request accepted.',
            'data' => new BookingResource($booking->fresh()->load('passenger')),
        ]);
    }

    public function reject(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('respond', $booking);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $booking->forceFill([
            'status' => BookingStatus::Rejected,
            'responded_at' => now(),
            'rejection_reason' => $validated['reason'] ?? null,
        ])->save();

        return response()->json([
            'message' => 'Request declined.',
            'data' => new BookingResource($booking->load('passenger')),
        ]);
    }

    /**
     * Called off by either side. An accepted booking gives its seat back.
     */
    public function cancel(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('cancel', $booking);

        $byDriver = $request->user()->getKey() === $booking->trip->driver_id;

        DB::transaction(function () use ($booking, $byDriver) {
            if ($booking->status->holdsSeat()) {
                $booking->trip->releaseSeats($booking->seats);
            }

            $booking->forceFill([
                'status' => $byDriver
                    ? BookingStatus::CancelledByDriver
                    : BookingStatus::CancelledByPassenger,
                'cancelled_at' => now(),
            ])->save();
        });

        return response()->json([
            'message' => 'Booking cancelled.',
            'data' => new BookingResource($booking->fresh()->load('passenger')),
        ]);
    }
}
