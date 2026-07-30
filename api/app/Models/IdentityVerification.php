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
// Document numbers and image keys never leave the server in an API response.
#[Hidden(['document_number', 'front_image_path', 'back_image_path', 'selfie_image_path'])]
class IdentityVerification extends Model
{
    protected function casts(): array
    {
        return [
            'document_type' => IdentityDocumentType::class,
            'status' => VerificationStatus::class,
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
