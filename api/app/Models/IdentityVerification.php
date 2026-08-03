<?php

namespace App\Models;

use App\Enums\IdentityDocumentType;
use App\Enums\VerificationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'document_type', 'document_number', 'full_name_on_document',
    'front_image_path', 'back_image_path', 'selfie_image_path',
])]
// Document numbers, dates of birth and image keys never leave the server in an
// API response. IdentityVerificationResource is the only thing that renders
// this model, and it exposes status alone.
#[Hidden(['document_number', 'date_of_birth', 'front_image_path', 'back_image_path', 'selfie_image_path'])]
class IdentityVerification extends Model
{
    protected function casts(): array
    {
        return [
            'document_type' => IdentityDocumentType::class,
            'status' => VerificationStatus::class,
            'date_of_birth' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
