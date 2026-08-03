<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Just enough of a booking to badge a trip in a list. The full record, with
 * the passenger attached, is BookingResource.
 *
 * @mixin Booking
 */
class BookingSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'seats' => $this->seats,
            'contact_unlocked' => $this->allowsContactExchange(),
        ];
    }
}
