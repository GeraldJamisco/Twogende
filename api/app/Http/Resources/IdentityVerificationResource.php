<?php

namespace App\Http\Resources;

use App\Models\IdentityVerification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Status of an identity submission, for the person who made it.
 *
 * Carries no document number, no date of birth and no image paths. The app
 * only needs to know where the submission stands — everything else is for the
 * reviewer, and every field left out is one that can't leak.
 *
 * @mixin IdentityVerification
 */
class IdentityVerificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'document_type' => $this->document_type->value,
            'status' => $this->status->value,
            'rejection_reason' => $this->rejection_reason,
            'submitted_at' => $this->created_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
