<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\RatedRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\RatingResource;
use App\Models\Booking;
use App\Models\Rating;
use App\Support\RatingTags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Rating the other side of a completed ride.
 *
 * Who may rate whom, and in which direction, is answered by
 * Booking::pendingRatingRoleFor() - a passenger rates the driver, the driver
 * rates the passenger, each once, and only after the trip is done.
 */
class RatingController extends Controller
{
    /**
     * Whether this user still owes a rating on this booking, and for whom.
     * The app uses it to decide whether to show the screen at all.
     */
    public function pending(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        $role = $booking->pendingRatingRoleFor($request->user());

        return response()->json([
            'due' => $role !== null,
            'rating_role' => $role?->value,

            // Every star count's vocabulary at once. The screen switches the
            // chips as the stars change and must not wait on a round trip.
            'tags' => $role === null ? [] : collect(range(1, Rating::MAX_STARS))
                ->mapWithKeys(fn (int $stars) => [$stars => RatingTags::offered($role, $stars)]),
            'chips_before_more' => RatingTags::CHIPS_BEFORE_MORE,
        ] + $this->theirRating($booking, $request->user()));
    }

    public function store(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        $role = $booking->pendingRatingRoleFor($request->user());

        if ($role === null) {
            // Either the trip isn't finished, they've already rated, or they
            // aren't part of this booking at all.
            return response()->json([
                'message' => 'There is no rating to leave on this ride.',
            ], 422);
        }

        $stars = (int) $request->input('stars', 0);

        $validated = $request->validate([
            'stars' => ['required', 'integer', 'between:'.Rating::MIN_STARS.','.Rating::MAX_STARS],
            'comment' => ['nullable', 'string', 'max:1000'],

            /*
             * Only the tags actually offered for the chosen star count, and
             * only ones that can be said about this side of the ride. These
             * become percentages on a profile, so a tag that arrived by any
             * other route than a deliberate tap would corrupt the number.
             *
             * Free text belongs in the comment, not in a countable field.
             */
            'tags' => ['sometimes', 'array', 'max:6'],
            'tags.*' => [Rule::in(RatingTags::allowed($role, $stars))],
        ]);

        $ratee = $role === RatedRole::Driver
            ? $booking->trip->driver
            : $booking->passenger;

        $rating = DB::transaction(function () use ($booking, $request, $ratee, $role, $validated) {
            $rating = $booking->ratings()->forceCreate([
                'rater_id' => $request->user()->getKey(),
                'ratee_id' => $ratee->getKey(),
                'ratee_role' => $role->value,
                'stars' => $validated['stars'],
                'tags' => $validated['tags'] ?? null,
                'comment' => $validated['comment'] ?? null,
            ]);

            // The averages on the user are denormalised so a profile renders
            // without aggregating. They have to move with the rating that
            // changed them, or a crash between the two leaves a score that
            // doesn't match its own ratings.
            $ratee->recalculateReputation($role);

            return $rating;
        });

        return response()->json([
            'data' => new RatingResource($rating),

            // Rating unseals what they said - that is the whole reason the
            // screen is worth finishing, so it comes back in the same response
            // rather than after another round trip.
        ] + $this->theirRating($booking->refresh(), $request->user()), 201);
    }

    /**
     * The other side's verdict, or the fact that one is waiting.
     *
     * `waiting` true with a null rating is the locked state: somebody has
     * rated this person and they can't see it yet.
     *
     * @return array{their_rating: array{waiting: bool, revealed: bool, rating: RatingResource|null}}
     */
    private function theirRating(Booking $booking, $user): array
    {
        $rating = $booking->ratingAbout($user);
        $revealed = $booking->ratingIsRevealedTo($user);

        return [
            'their_rating' => [
                'waiting' => $rating !== null,
                'revealed' => $revealed,
                'rating' => $rating && $revealed ? new RatingResource($rating) : null,
            ],
        ];
    }
}
