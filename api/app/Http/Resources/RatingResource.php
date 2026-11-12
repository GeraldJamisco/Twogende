<?php

namespace App\Http\Resources;

use App\Models\Rating;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Rating
 */
class RatingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'stars' => $this->stars,
            'tags' => $this->tags ?? [],
            'comment' => $this->comment,
            'ratee_role' => $this->ratee_role->value,
            'left_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
