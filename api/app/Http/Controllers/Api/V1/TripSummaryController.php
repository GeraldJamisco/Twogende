<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Enums\RatedRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicUserResource;
use App\Http\Resources\RatingResource;
use App\Models\Rating;
use App\Models\Trip;
use App\Support\RatingTags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What a driver sees once a trip is finished: the split, and the passengers
 * still waiting to be rated.
 *
 * The passenger's equivalent is the single-booking rating endpoint a
 * passenger only ever rates one driver, while a driver may finish a trip
 * owing four ratings.
 */
class TripSummaryController extends Controller
{
    public function __invoke(Request $request, Trip $trip): JsonResponse
    {
        // Only the driver sees the earnings side of a trip.
        $this->authorize('manageBookings', $trip);

        $bookings = $trip->bookings()
            ->where('status', BookingStatus::Completed)
            ->with('passenger')
            ->get();

        $gross = (int) $bookings->sum('total_contribution');

        /*
         * Summing the per-seat fees rather than taking a percentage of the
         * total: the fee a driver is shown per passenger has to add up to the
         * fee on the summary, and rounding each seat separately is the only
         * way that stays true.
         */
        $fee = (int) $bookings->sum(fn ($booking) => $booking->service_fee ?? $booking->calculateServiceFee());

        return response()->json([
            'data' => [
                'trip_id' => $trip->id,
                'route' => [
                    'origin' => $trip->origin_name,
                    'destination' => $trip->destination_name,
                ],
                'departed_at' => $trip->departure_at?->toIso8601String(),
                'completed_at' => $trip->completed_at?->toIso8601String(),

                // Null when a driver never pressed start - a duration invented
                // from the scheduled time would be fiction.
                'duration_minutes' => $trip->started_at && $trip->completed_at
                    ? (int) $trip->started_at->diffInMinutes($trip->completed_at)
                    : null,

                'seats_filled' => (int) $bookings->sum('seats'),
                'currency' => $trip->currency,

                'earnings' => [
                    'gross' => $gross,          // what passengers contributed
                    'service_fee' => $fee,      // what Twogende keeps
                    'net' => $gross - $fee,     // what the driver keeps
                    'commission_rate' => (float) config('twogende.platform.commission_rate'),
                ],

                /*
                 * The whole vocabulary, once. A driver finishing a full car
                 * sees a card per passenger, and asking for the same list four
                 * times to render four identical sets of chips is silly.
                 */
                'rating_tags' => collect(range(1, Rating::MAX_STARS))
                    ->mapWithKeys(fn (int $stars) => [
                        $stars => RatingTags::offered(RatedRole::Passenger, $stars),
                    ]),
                'chips_before_more' => RatingTags::CHIPS_BEFORE_MORE,

                'passengers' => $bookings->map(fn ($booking) => [
                    'booking_id' => $booking->id,
                    'passenger' => new PublicUserResource($booking->passenger),
                    'seats' => $booking->seats,
                    'pickup_name' => $booking->pickup_name ?? $trip->origin_name,
                    'contribution' => $booking->total_contribution,
                    'service_fee' => $booking->service_fee ?? $booking->calculateServiceFee(),
                    'net' => $booking->driverPayout(),

                    // Whether this passenger is still owed a rating, so the
                    // screen knows which cards to show.
                    'rating_due' => $booking->pendingRatingRoleFor($request->user()) !== null,

                    /*
                     * Whether this passenger has already rated the driver.
                     * Shown as a sealed card until the driver rates back - it
                     * is the reason a driver finishes the screen at all.
                     */
                    'their_rating' => [
                        'waiting' => $booking->ratingAbout($request->user()) !== null,
                        'revealed' => $booking->ratingIsRevealedTo($request->user()),
                        'rating' => $booking->ratingIsRevealedTo($request->user())
                            && $booking->ratingAbout($request->user())
                                ? new RatingResource($booking->ratingAbout($request->user()))
                                : null,
                    ],
                ])->values(),
            ],
        ]);
    }
}
