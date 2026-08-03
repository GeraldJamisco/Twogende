<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'sender_id' => $this->sender_id,

            // 'user' or 'system'. System notices render as a Twogende card
            // rather than a bubble, so nobody thinks their driver typed them.
            'kind' => $this->kind->value,

            // Saves every caller comparing ids to work out which side to draw.
            // A system message belongs to neither party.
            'is_mine' => $this->sender_id !== null
                && $this->sender_id === $request->user()?->getKey(),
            // Present only on their own kinds, so a renderer can switch on
            // shape as well as on `kind`.
            'location' => $this->latitude !== null ? [
                'latitude' => (float) $this->latitude,
                'longitude' => (float) $this->longitude,
            ] : null,

            'image_url' => $this->image_path
                ? route('messages.image', ['message' => $this->id])
                : null,

            'read' => $this->read_at !== null,
            'sent_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
