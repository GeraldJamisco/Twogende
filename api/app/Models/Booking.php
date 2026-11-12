<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RatedRole;
use App\Enums\TripStatus;
use App\Support\Distance;
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
            'service_fee' => 'integer',
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
     * Where this ride has got to, for the tracking screen's four steps.
     *
     * Derived rather than stored: every input already exists, and a stored
     * stage would be one more thing that can disagree with reality.
     */
    public function trackingStage(): string
    {
        if ($this->status === BookingStatus::Completed || $this->trip?->status === TripStatus::Completed) {
            return 'completed';
        }

        if ($this->driver_arrived_at !== null) {
            return 'arrived';
        }

        if ($this->trip?->status === TripStatus::InProgress) {
            return 'en_route';
        }

        return $this->status === BookingStatus::Accepted ? 'confirmed' : 'requested';
    }

    /**
     * Rough minutes until the driver reaches the pickup point.
     *
     * Straight-line distance at an assumed town speed - NOT a routed estimate.
     * Real road distance needs the Directions API, which isn't enabled; this
     * is honest about being approximate and is only shown once the driver is
     * actually sharing a position.
     */
    public function minutesAway(): ?int
    {
        $trip = $this->trip;

        if (! $trip?->driver_lat || ! $trip->driver_lng) {
            return null;
        }

        $freshFor = (int) config('twogende.trips.location_freshness_minutes');
        if ($trip->driver_located_at?->diffInMinutes(now()) > $freshFor) {
            return null;
        }

        $latitude = $this->pickup_lat ?? $trip->origin_lat;
        $longitude = $this->pickup_lng ?? $trip->origin_lng;

        if ($latitude === null || $longitude === null) {
            return null;
        }

        $metres = Distance::metresBetween(
            (float) $trip->driver_lat,
            (float) $trip->driver_lng,
            (float) $latitude,
            (float) $longitude,
        );

        $speed = (float) config('twogende.trips.average_speed_kmh');
        $minutes = ($metres / 1000) / max(1.0, $speed) * 60;

        return max(1, (int) ceil($minutes));
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
    /**
     * The commission on this seat, at today's rate.
     *
     * Only used at the moment a ride completes once it has, read service_fee,
     * which is what the driver was actually shown.
     */
    public function calculateServiceFee(): int
    {
        $rate = (float) config('twogende.platform.commission_rate');

        return (int) round($this->total_contribution * $rate);
    }

    /** What reaches the driver: the contribution less the fee. */
    public function driverPayout(): int
    {
        // Subtracting rather than multiplying by (1 - rate) so the two halves
        // can never round apart and leave a shilling unaccounted for.
        return $this->total_contribution - ($this->service_fee ?? $this->calculateServiceFee());
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** Whether the contribution on this ride has been settled. */
    public function isSettled(): bool
    {
        return $this->payments()->where('status', PaymentStatus::Completed->value)->exists();
    }

    /** What the other side said about this user on this ride, if anything. */
    public function ratingAbout(User $user): ?Rating
    {
        return $this->ratings()->where('ratee_id', $user->getKey())->first();
    }

    /**
     * Whether this user is allowed to read what was said about them yet.
     *
     * Sealed until they have rated the other side, so nobody writes a reply
     * to a score rather than an account of a journey. Opened by time as well,
     * or a rating from somebody who never comes back stays sealed forever.
     */
    public function ratingIsRevealedTo(User $user): bool
    {
        if ($this->pendingRatingRoleFor($user) === null) {
            // Nothing outstanding from them: either they have rated, or they
            // were never entitled to. Both mean nothing left to withhold.
            return true;
        }

        $days = (int) config('twogende.ratings.reveal_after_days');

        return $this->completed_at !== null
            && $this->completed_at->addDays($days)->isPast();
    }

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
