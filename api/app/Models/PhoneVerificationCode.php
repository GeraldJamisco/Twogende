<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

/**
 * A one-time code sent by SMS. Only the hash is stored, so a database leak
 * doesn't hand over live codes.
 */
#[Hidden(['code_hash'])]
class PhoneVerificationCode extends Model
{
    /** Wrong-code attempts allowed before the code is burned. */
    public const MAX_ATTEMPTS = 5;

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function isUsable(): bool
    {
        return $this->consumed_at === null
            && $this->attempts < self::MAX_ATTEMPTS
            && $this->expires_at->isFuture();
    }
}
