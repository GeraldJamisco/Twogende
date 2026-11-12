<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\MessageKind;
use App\Enums\TripCancellationReason;
use App\Enums\TripStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use RuntimeException;

#[Fillable([
    'vehicle_id',
    'origin_name',
    'origin_place_id',
    'origin_lat',
    'origin_lng',
    'destination_name',
    'destination_place_id',
    'destination_lat',
    'destination_lng',
    'departure_at',
    'seats_total',
    'contribution_per_seat',
    'notes',
])]
class Trip extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'cancellation_reason_code' => TripCancellationReason::class,
            'departure_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'status' => TripStatus::class,
            'seats_total' => 'integer',
            'seats_available' => 'integer',
            'contribution_per_seat' => 'integer',
            'origin_lat' => 'float',
            'origin_lng' => 'float',
            'destination_lat' => 'float',
            'destination_lng' => 'float',
            'driver_lat' => 'float',
            'driver_lng' => 'float',
            'driver_located_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /** @return BelongsTo<Vehicle, $this> */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /** @return HasMany<Booking, $this> */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * Trips a passenger can actually request: still scheduled, still has a
     * seat, and hasn't already left.
     *
     * @param  Builder<Trip>  $query
     */
    public function scopeBookable(Builder $query): void
    {
        $query->whereIn('status', [TripStatus::Scheduled, TripStatus::InProgress])
            ->where('seats_available', '>', 0)
            // A trip that has just set off but still has a seat stays findable
            // for a short grace period - that's the "On the way" state on the
            // search screen. Past it, the car is genuinely gone.
            ->where('departure_at', '>', now()->subMinutes((int) config('twogende.trips.departure_grace_minutes')));
    }

    /**
     * Trips leaving from a place the passenger would accept.
     *
     * Two legs, OR'd. Exact place_id equality is the cheap, indexed one and
     * covers the common case where both people picked the same suggestion.
     * The radius leg catches near-misses "Ntinda" and "Ntinda Stage" are
     * different Google places a couple of hundred metres apart, and a
     * passenger should not miss that ride.
     *
     * @param  Builder<Trip>  $query
     */
    public function scopeFromPlace(Builder $query, string $placeId, ?float $latitude = null, ?float $longitude = null): void
    {
        $query->where(function (Builder $query) use ($placeId, $latitude, $longitude) {
            $query->where('origin_place_id', $placeId);

            if ($latitude !== null && $longitude !== null) {
                $query->orWhere(fn (Builder $q) => $this->withinRadius($q, 'origin', $latitude, $longitude));
            }
        });
    }

    /**
     * @param  Builder<Trip>  $query
     */
    public function scopeToPlace(Builder $query, string $placeId, ?float $latitude = null, ?float $longitude = null): void
    {
        $query->where(function (Builder $query) use ($placeId, $latitude, $longitude) {
            $query->where('destination_place_id', $placeId);

            if ($latitude !== null && $longitude !== null) {
                $query->orWhere(fn (Builder $q) => $this->withinRadius($q, 'destination', $latitude, $longitude));
            }
        });
    }

    /**
     * Trips departing on a given calendar day, in the app's timezone.
     *
     * @param  Builder<Trip>  $query
     */
    public function scopeDepartingOn(Builder $query, CarbonInterface $date): void
    {
        $query->whereBetween('departure_at', [
            $date->copy()->startOfDay(),
            $date->copy()->endOfDay(),
        ]);
    }

    /**
     * @param  Builder<Trip>  $query
     */
    public function scopeWithSeatsFor(Builder $query, int $seats): void
    {
        $query->where('seats_available', '>=', $seats);
    }

    /**
     * Haversine distance in kilometres, compared against the configured match
     * radius. Rows with no coordinates yield NULL, which fails the comparison
     * exactly what we want.
     *
     * @param  Builder<Trip>  $query
     */
    private function withinRadius(Builder $query, string $column, float $latitude, float $longitude): void
    {
        $radius = (float) config('twogende.places.match_radius_km');

        $query->whereRaw(
            "(6371 * acos(
                least(1.0,
                    cos(radians(?)) * cos(radians({$column}_lat))
                    * cos(radians({$column}_lng) - radians(?))
                    + sin(radians(?)) * sin(radians({$column}_lat))
                )
            )) <= ?",
            [$latitude, $longitude, $latitude, $radius]
        );
    }

    /**
     * Take `$seats` off this trip, or fail if they're no longer there.
     *
     * Two passengers requesting the last seat at the same moment is the one
     * race this schema genuinely has. The row is locked for the duration of
     * the check-and-decrement, so the second caller reads the already
     * decremented count and gets a false back rather than overselling.
     *
     * Must be called inside a transaction accepting a booking has to commit
     * the seat count and the booking status together or neither.
     */
    public function claimSeats(int $seats): bool
    {
        if (DB::transactionLevel() === 0) {
            throw new RuntimeException('Trip::claimSeats() must run inside a transaction.');
        }

        $locked = static::query()->lockForUpdate()->find($this->getKey());

        if (! $locked || $locked->seats_available < $seats) {
            return false;
        }

        $locked->decrement('seats_available', $seats);
        $this->refresh();

        return true;
    }

    /**
     * Put seats back when an accepted booking is cancelled. Capped at
     * seats_total so a double-release can't invent capacity.
     */
    public function releaseSeats(int $seats): void
    {
        // Assigned directly rather than through update(): seats_available is
        // deliberately not mass-assignable, so update() would silently no-op.
        $this->seats_available = min($this->seats_total, $this->seats_available + $seats);
        $this->save();
    }

    /**
     * Eager-load only the caller's own booking, so a search result can be
     * badged "Requested" without leaking who else is on the trip.
     *
     * @param  Builder<Trip>  $query
     */
    public function scopeWithMyBooking(Builder $query, ?User $user): void
    {
        if (! $user) {
            return;
        }

        $query->with(['bookings' => fn ($q) => $q->where('passenger_id', $user->getKey())]);
    }

    public function loadMyBooking(?User $user): void
    {
        if ($user) {
            $this->load(['bookings' => fn ($q) => $q->where('passenger_id', $user->getKey())]);
        }
    }

    /**
     * Cancel the trip and everything riding on it.
     *
     * Live bookings are cancelled too: the seat is gone either way, and
     * leaving a booking "accepted" against a dead trip would have passengers
     * turning up for a car that isn't coming.
     */
    /**
     * Call the ride off.
     *
     * Everyone riding on it is cancelled in the same transaction - a trip that
     * is gone while its bookings still say "confirmed" would leave passengers
     * standing at a stage waiting for a car that is never coming.
     *
     * They are also *told*, in the conversation they already have open. Push
     * notifications don't exist yet, so the chat is the only channel that
     * actually reaches somebody, and a cancellation nobody hears about is the
     * worst thing this app could do to a person.
     */
    public function cancel(?TripCancellationReason $reason = null, ?string $note = null): void
    {
        DB::transaction(function () use ($reason, $note) {
            $affected = $this->bookings()
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Accepted])
                ->get();

            $this->bookings()
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Accepted])
                ->update([
                    'status' => BookingStatus::CancelledByDriver,
                    'cancelled_at' => now(),
                    'updated_at' => now(),
                ]);

            $this->forceFill([
                'status' => TripStatus::Cancelled,
                'cancelled_at' => now(),
                'cancellation_reason_code' => $reason?->value,
                'cancellation_note' => $note,
            ])->save();

            foreach ($affected as $booking) {
                $this->notifyOfCancellation($booking, $reason);
            }
        });
    }

    /**
     * The notice in the conversation.
     *
     * Written as a system message so it reads as Twogende speaking, not as
     * something the driver typed - and so it survives the chat window closing,
     * which a person's message would not be able to do.
     */
    private function notifyOfCancellation(Booking $booking, ?TripCancellationReason $reason): void
    {
        $because = $reason?->passengerNotice() ?? 'the driver can no longer make the journey';

        $message = new Message([
            'body' => sprintf(
                'This ride to %s has been cancelled because %s. Your seat has been released - you can search for another ride now.',
                $this->destination_name,
                $because,
            ),
        ]);

        $message->booking_id = $booking->getKey();
        $message->kind = MessageKind::System;
        $message->sender_id = null;
        $message->save();
    }

    /**
     * Finish the trip: accepted bookings become completed, and both sides'
     * completed-trip counts go up.
     *
     * Those counts are denormalised onto users so a profile renders without
     * aggregating, which means they have to move in the same transaction as
     * the status otherwise a failure halfway leaves reputation overstated.
     */
    public function complete(): void
    {
        DB::transaction(function () {
            $accepted = $this->bookings()
                ->where('status', BookingStatus::Accepted)
                ->get();

            foreach ($accepted as $booking) {
                $booking->forceFill([
                    'status' => BookingStatus::Completed,
                    'completed_at' => now(),

                    // Fixed here, at the one moment the ride is done, so a
                    // later change to the rate can't rewrite what a driver
                    // was told they earned.
                    'service_fee' => $booking->calculateServiceFee(),
                ])->save();

                User::query()->whereKey($booking->passenger_id)->increment('trips_as_passenger');
            }

            $this->forceFill([
                'status' => TripStatus::Completed,
                'completed_at' => now(),
            ])->save();

            // A driver who completed a trip nobody rode on still drove it, but
            // it isn't a carpool only count trips that carried someone.
            if ($accepted->isNotEmpty()) {
                User::query()->whereKey($this->driver_id)->increment('trips_as_driver');
            }
        });
    }

    /** Seats currently held by accepted bookings. The source of truth for repair jobs. */
    public function seatsTaken(): int
    {
        return (int) $this->bookings()
            ->whereIn('status', [BookingStatus::Accepted, BookingStatus::Completed])
            ->sum('seats');
    }
}
