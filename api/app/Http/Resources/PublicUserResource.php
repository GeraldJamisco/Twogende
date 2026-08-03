<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Somebody *else's* profile the driver on a search result, the passenger on
 * a request.
 *
 * This class is a security boundary, not a formatting choice. It must never
 * carry the phone number, email, or identity-document details. Contact
 * details are released only through the booking contact endpoint, and only
 * once a booking has been accepted.
 *
 * @mixin User
 */
class PublicUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,

            /*
             * The one word used to identify somebody in the app — greetings,
             * chat headers, "David will confirm your seat shortly". Resolved
             * here so no client ever splits a name itself and gets it wrong.
             */
            'first_name' => $this->name
                ? Str::of($this->name)->trim()->explode(' ')->first()
                : null,
            'bio' => $this->bio,
            'photo_url' => $this->photo_path ? asset('storage/'.$this->photo_path) : null,

            'verification' => [
                'phone' => $this->phone_verified_at !== null,
                'identity' => $this->identity_verified_at !== null,
            ],

            'reputation' => [
                'rating_as_driver' => $this->rating_as_driver,
                'ratings_as_driver_count' => $this->ratings_as_driver_count,
                'rating_as_passenger' => $this->rating_as_passenger,
                'ratings_as_passenger_count' => $this->ratings_as_passenger_count,
                'trips_as_driver' => $this->trips_as_driver,
                'trips_as_passenger' => $this->trips_as_passenger,
            ],

            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
