<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Enums\TripCancellationReason;
use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicUserResource;
use App\Http\Resources\UserResource;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    /**
     * The signed-in user. The app calls this on launch to decide which tabs to
     * show, so it carries the verification flags rather than making the client
     * infer them.
     */
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * The notification switches on the settings screen.
     *
     * Separate from update() because these are consent, not profile detail.
     * Marketing consent under the Data Protection and Privacy Act, 2019 has to
     * be given rather than assumed, so it defaults off and is only ever turned
     * on by this call.
     */
    public function updateNotifications(Request $request): UserResource
    {
        $validated = $request->validate([
            'notify_ride_updates' => ['sometimes', 'boolean'],
            'notify_marketing' => ['sometimes', 'boolean'],
        ]);

        $request->user()->update($validated);

        return new UserResource($request->user()->refresh());
    }

    /**
     * Close the account.
     *
     * Soft-deleted rather than erased, because a completed trip has two sides
     * and a payment record has a tax life of its own - wiping the row would
     * take the other person's history with it. What *is* immediate: the
     * account stops working, every token is revoked, and anything still live
     * is called off so nobody is left waiting at a stage for somebody who has
     * left.
     *
     * The erasure the privacy policy promises - identity documents and selfie
     * within 30 days - is a scheduled job that does not exist yet. It is on
     * the launch checklist, and until it runs this endpoint keeps only the
     * promise it can actually keep.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        DB::transaction(function () use ($user, $validated) {
            // Published rides go first, so their passengers are told why - // Trip::cancel() writes the notice into each conversation.
            $user->trips()
                ->whereIn('status', [TripStatus::Scheduled, TripStatus::InProgress])
                ->get()
                ->each(fn (Trip $trip) => $trip->cancel(TripCancellationReason::Other));

            // Seats they were holding on other people's rides.
            $user->bookings()
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Accepted])
                ->update([
                    'status' => BookingStatus::CancelledByPassenger,
                    'cancelled_at' => now(),
                    'updated_at' => now(),
                ]);

            $user->forceFill(['deletion_reason' => $validated['reason'] ?? null])->save();

            // Every session on every device, not just this one.
            $user->tokens()->delete();

            $user->delete();
        });

        return response()->json([
            'message' => 'Your account has been closed.',
        ]);
    }

    /**
     * Somebody else's profile the driver on a trip card, the passenger who
     * asked for a seat. Goes out through PublicUserResource, so it carries a
     * reputation and never a phone number.
     */
    public function publicProfile(User $user): PublicUserResource
    {
        return (new PublicUserResource($user))->withHighlights();
    }

    /**
     * Edit your own details.
     *
     * This is where a brand-new account gets its name: verifying a code
     * creates the account, so the first thing a new user does is fill this in.
     */
    public function update(Request $request): UserResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:500'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
        ]);

        $request->user()->update($validated);

        return new UserResource($request->user()->refresh());
    }
}
