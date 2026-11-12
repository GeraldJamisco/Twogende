<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A booking as either side sees it.
 *
 * The passenger goes out through PublicUserResource, so a driver reviewing
 * requests sees a name, photo and rating - never a phone number. Contact
 * details are released separately, and only once the request is accepted.
 *
 * @mixin Booking
 */
class BookingResource extends JsonResource
{
    /**
     * The other party to this booking, from the reader's point of view.
     */
    private function resolveOther(Request $request): ?PublicUserResource
    {
        $viewerId = $request->user()?->getKey();

        if ($viewerId === null || ! $this->relationLoaded('trip')) {
            return null;
        }

        $other = $viewerId === $this->trip?->driver_id
            ? $this->passenger
            : $this->trip?->driver;

        return $other ? new PublicUserResource($other) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'passenger' => new PublicUserResource($this->whenLoaded('passenger')),
            'seats' => $this->seats,

            /*
             * Where along the route this passenger joins. Null means they
             * didn't say, in which case they're joining at the trip's origin - * the app substitutes that rather than showing a blank.
             */
            'pickup' => [
                'name' => $this->pickup_name,
                'place_id' => $this->pickup_place_id,
                'latitude' => $this->pickup_lat,
                'longitude' => $this->pickup_lng,
            ],

            'contribution' => [
                'per_seat' => $this->contribution_per_seat,
                'total' => $this->total_contribution,
                'currency' => $this->currency,
            ],

            'trip' => new TripResource($this->whenLoaded('trip')),

            /*
             * Whoever the reader isn't. The chat screen is the same screen for
             * both sides, so which of the two people to put in the header is a
             * server-side fact rather than something every client re-derives.
             */
            'with' => $this->resolveOther($request),

            /*
             * The chat screen tells people when this conversation closes, so
             * the same value that drives that copy also gates sending.
             */
            'chat' => [
                'closes_at' => $this->chatClosesAt()?->toIso8601String(),
                'open' => $this->chatIsOpen(),
            ],

            /*
             * Drives the tracking screen's four steps and the bar on the home
             * screen. Both derived, so they can't drift from the trip.
             */
            'tracking' => [
                'stage' => $this->trackingStage(),
                'minutes_away' => $this->minutesAway(),
            ],

            'status' => $this->status->value,
            'message' => $this->message,
            'contact_unlocked' => $this->allowsContactExchange(),
            'rejection_reason' => $this->rejection_reason,
            'requested_at' => $this->created_at?->toIso8601String(),
            'responded_at' => $this->responded_at?->toIso8601String(),
        ];
    }
}
