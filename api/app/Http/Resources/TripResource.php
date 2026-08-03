<?php

namespace App\Http\Resources;

use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Trip
 */
class TripResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'driver' => new PublicUserResource($this->whenLoaded('driver')),
            'vehicle' => new VehicleResource($this->whenLoaded('vehicle')),

            'origin' => [
                'name' => $this->origin_name,
                'place_id' => $this->origin_place_id,
                'latitude' => $this->origin_lat,
                'longitude' => $this->origin_lng,
            ],
            'destination' => [
                'name' => $this->destination_name,
                'place_id' => $this->destination_place_id,
                'latitude' => $this->destination_lat,
                'longitude' => $this->destination_lng,
            ],

            'departure_at' => $this->departure_at->toIso8601String(),

            'seats' => [
                'total' => $this->seats_total,
                'available' => $this->seats_available,
            ],

            /*
             * "Contribution", never "fare". Twogende is cost-sharing between
             * travellers, not commercial transport the naming carries all
             * the way to the wire.
             */
            'contribution' => [
                'per_seat' => $this->contribution_per_seat,
                'currency' => $this->currency,
            ],

            'notes' => $this->notes,
            'status' => $this->status->value,

            // Present only where the caller's own booking has been loaded, so
            // the app can render "Requested" / "Accepted" on a search result.
            'my_booking' => $this->whenLoaded(
                'bookings',
                fn () => $this->bookings->first()
                    ? new BookingSummaryResource($this->bookings->first())
                    : null
            ),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
