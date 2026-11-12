<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\PhoneNumber;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in user's own record. Phone number is included because it's
 * theirs; a separate resource will represent *other* people's profiles, where
 * the number is withheld until a booking is accepted.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'phone_display' => PhoneNumber::forDisplay($this->phone),
            'email' => $this->email,
            'bio' => $this->bio,
            'photo_url' => $this->photo_path ? asset('storage/'.$this->photo_path) : null,

            // An account exists from the moment a code is verified, which can
            // be before anyone has been asked their name. The app uses this to
            // decide whether to send a new user to fill in their profile.
            'profile_complete' => filled($this->name),

            'verification' => [
                'phone' => $this->phone_verified_at !== null,
                'identity' => $this->identity_verified_at !== null,
                // The gate on publishing trips: identity plus an approved
                // vehicle. The app uses this to decide whether to show the
                // driver tab or the "become a driver" prompt.
                'can_drive' => $this->canDrive(),
            ],

            'reputation' => [
                'rating_as_driver' => $this->rating_as_driver,
                'ratings_as_driver_count' => $this->ratings_as_driver_count,
                'rating_as_passenger' => $this->rating_as_passenger,
                'ratings_as_passenger_count' => $this->ratings_as_passenger_count,
                'trips_as_driver' => $this->trips_as_driver,
                'trips_as_passenger' => $this->trips_as_passenger,
            ],

            /*
             * The settings screen's two switches. Ride updates are the
             * messages a booking is useless without; marketing is opt-in.
             */
            'notifications' => [
                'ride_updates' => (bool) $this->notify_ride_updates,
                'marketing' => (bool) $this->notify_marketing,
            ],

            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
