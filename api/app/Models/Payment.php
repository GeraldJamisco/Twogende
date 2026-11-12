<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * An attempt to settle one booking's contribution.
 *
 * Nothing here moves money. Cash is two people and a handshake, which this
 * only records; mobile money is pushed through a gateway that may not be
 * connected at all. A row saying "completed" means somebody told us it
 * completed - for cash, the passenger; for mobile money, the provider.
 */
#[Fillable([])]
class Payment extends Model
{
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'status' => PaymentStatus::class,
            'amount' => 'integer',
            'requested_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<User, $this> */
    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function payee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payee_id');
    }

    /**
     * "TWG-8H2K41" - what the passenger sees when it's done.
     *
     * Deliberately not the id: a reference is read aloud down a phone line to
     * sort out a dispute, so it wants to be short, unmistakable and free of
     * any hint about how many payments the platform has taken. Ambiguous
     * characters are left out for the same reason.
     */
    public static function generateReference(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

        do {
            $reference = 'TWG-'.collect(range(1, 6))
                ->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])
                ->implode('');
        } while (static::query()->where('reference', $reference)->exists());

        return $reference;
    }

    public function markCompleted(?string $providerReference = null): void
    {
        $this->forceFill([
            'status' => PaymentStatus::Completed,
            'provider_reference' => $providerReference ?? $this->provider_reference,
            'completed_at' => now(),
            'failure_reason' => null,
        ])->save();
    }

    public function markFailed(string $reason): void
    {
        $this->forceFill([
            'status' => PaymentStatus::Failed,
            'failure_reason' => Str::limit($reason, 250),
        ])->save();
    }
}
