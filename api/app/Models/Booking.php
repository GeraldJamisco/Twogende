<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\RatedRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

#[Fillable(['seats', 'message'])]
class Booking extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => BookingStatus::class,
            'seats' => 'integer',
            'contribution_per_seat' => 'integer',
            'total_contribution' => 'integer',
            'responded_at' => 'datetime',
            'passenger_located_at' => 'datetime',
            'driver_arrived_at' => 'datetime',
            'passenger_lat' => 'float',
            'passenger_lng' => 'float',
            'pickup_lat' => 'float',
            'pickup_lng' => 'float',
            'cancelled_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Trip, $this> */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    /** @return BelongsTo<User, $this> */
    public function passenger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'passenger_id');
    }

    /**
     * The conversation on this booking. A booking is the only reason two
     * people on Twogende can message each other.
     *
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /** @return HasMany<Rating, $this> */
    public function ratings(): HasMany
    {
        return $this->hasMany(Rating::class);
    }

    /**
     * When this booking's conversation stops accepting messages.
     *
     * The chat screen promises people a date; enforcing it here is what makes
     * that promise true rather than decoration.
     */
    public function chatClosesAt(): ?Carbon
    {
        return $this->trip?->departure_at
            ?->copy()
            ->addHours((int) config('twogende.chat.open_hours'));
    }

    public function chatIsOpen(): bool
    {
        $closesAt = $this->chatClosesAt();

        return $closesAt !== null && $closesAt->isFuture();
    }

    /**
     * Contact details are withheld until the driver accepts the phone /
     * WhatsApp handoff is the reward for acceptance, not a free lookup.
     */
    public function allowsContactExchange(): bool
    {
        return $this->status === BookingStatus::Accepted
            || $this->status === BookingStatus::Completed;
    }

    /**
     * Whether `$user` still owes a rating on this booking, and for which role
     * the person they'd be rating counts. Null when no rating is due.
     */
    public function pendingRatingRoleFor(User $user): ?RatedRole
    {
        if ($this->status !== BookingStatus::Completed) {
            return null;
        }

        if ($this->ratings()->where('rater_id', $user->getKey())->exists()) {
            return null;
        }

        return match ($user->getKey()) {
            $this->passenger_id => RatedRole::Driver,     // passenger rates the driver
            $this->trip->driver_id => RatedRole::Passenger, // driver rates the passenger
            default => null,
        };
    }
}
