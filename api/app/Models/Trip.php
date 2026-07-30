<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\TripStatus;
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
    'origin_lat',
    'origin_lng',
    'destination_name',
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
            'departure_at' => 'datetime',
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
        $query->where('status', TripStatus::Scheduled)
            ->where('seats_available', '>', 0)
            ->where('departure_at', '>', now());
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

    /** Seats currently held by accepted bookings. The source of truth for repair jobs. */
    public function seatsTaken(): int
    {
        return (int) $this->bookings()
            ->whereIn('status', [BookingStatus::Accepted, BookingStatus::Completed])
            ->sum('seats');
    }
}
