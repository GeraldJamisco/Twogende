<?php

namespace App\Http\Resources;

use App\Enums\RatedRole;
use App\Models\User;
use App\Support\RatingTags;
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
     * Tag highlights cost a query per person, so they are off by default a
     * search result showing twelve drivers must not run twelve tallies. Only
     * a screen that renders one profile turns them on.
     */
    private bool $withHighlights = false;

    public function withHighlights(): static
    {
        $this->withHighlights = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,

            /*
             * The one word used to identify somebody in the app - greetings,
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

            /*
             * What people actually say, as a percentage per category
             * "Smooth driving 96%". Absent rather than empty when a person
             * hasn't been rated enough for any of it to mean anything.
             */
            $this->mergeWhen($this->withHighlights, fn () => [
                'highlights' => [
                    'as_driver' => RatingTags::highlightsFor($this->resource, RatedRole::Driver),
                    'as_passenger' => RatingTags::highlightsFor($this->resource, RatedRole::Passenger),
                ],
            ]),

            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
