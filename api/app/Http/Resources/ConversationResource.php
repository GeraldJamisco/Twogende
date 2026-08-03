<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row on the Chats tab.
 *
 * "The other person" is resolved here rather than in the app: whether you're
 * the driver or the passenger on a given booking is a server-side fact, and
 * making every client re-derive it invites one of them getting it wrong.
 *
 * @mixin Booking
 */
class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewerId = $request->user()?->getKey();
        $isDriver = $viewerId === $this->trip?->driver_id;

        $other = $isDriver ? $this->passenger : $this->trip?->driver;
        $latest = $this->messages->first();

        return [
            'booking_id' => $this->id,
            'trip_id' => $this->trip_id,
            'with' => $other ? new PublicUserResource($other) : null,
            'route' => $this->trip
                ? $this->trip->origin_name.' → '.$this->trip->destination_name
                : null,
            'departure_at' => $this->trip?->departure_at?->toIso8601String(),
            'booking_status' => $this->status->value,

            /*
             * Splits the list into conversations still running and ones that
             * have closed. Same window the send endpoint enforces, so the two
             * can't disagree.
             */
            'chat' => [
                'closes_at' => $this->chatClosesAt()?->toIso8601String(),
                'open' => $this->chatIsOpen(),
            ],

            'last_message' => $latest ? [
                'body' => $latest->body,
                'sent_at' => $latest->created_at?->toIso8601String(),
                'is_mine' => $latest->sender_id === $viewerId,
            ] : null,

            'unread_count' => (int) ($this->unread_count ?? 0),
        ];
    }
}
