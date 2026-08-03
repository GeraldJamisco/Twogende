<?php

namespace App\Models;

use App\Enums\MessageKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message in the conversation attached to a booking.
 */
#[Fillable(['body'])]
class Message extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'kind' => MessageKind::class,
            'read_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    /** Written by Twogende rather than by either party. */
    public function isSystem(): bool
    {
        return $this->kind === MessageKind::System;
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<User, $this> */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
