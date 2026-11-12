<?php

namespace App\Models;

use App\Enums\RatedRole;
use App\Enums\VerificationStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/*
 * No password: a verified phone number is the only credential.
 *
 * `name` is the *display* name - whatever this person chose to be called, very
 * often a nickname. It is what appears on trip cards, profiles and greetings.
 *
 * It is deliberately not their legal name. That is captured separately, during
 * identity verification, as identity_verifications.full_name_on_document, and
 * is used only to check somebody is who they say they are. Never render it.
 */
#[Fillable(['name', 'email', 'photo_path', 'bio', 'notify_ride_updates', 'notify_marketing'])]
#[Hidden(['remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * Defaults that match the column defaults.
     *
     * Without these a freshly built User has null where the database would
     * have written true, and anything reading the attribute before a reload
     * sees the wrong answer - the same class of bug as a missing cast, and
     * this project has already been bitten by it twice.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'notify_ride_updates' => true,
        'notify_marketing' => false,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'phone_verified_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'identity_verified_at' => 'datetime',
            'notify_ride_updates' => 'boolean',
            'notify_marketing' => 'boolean',
            'rating_as_driver' => 'float',
            'rating_as_passenger' => 'float',
        ];
    }

    // Relationships

    /** @return HasMany<Vehicle, $this> */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    /** @return HasMany<IdentityVerification, $this> */
    public function identityVerifications(): HasMany
    {
        return $this->hasMany(IdentityVerification::class);
    }

    /** Trips this user is driving. @return HasMany<Trip, $this> */
    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class, 'driver_id');
    }

    /** Seats this user has requested on other people's trips. @return HasMany<Booking, $this> */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'passenger_id');
    }

    /** @return HasMany<Rating, $this> */
    public function ratingsReceived(): HasMany
    {
        return $this->hasMany(Rating::class, 'ratee_id');
    }

    /** @return HasMany<Rating, $this> */
    public function ratingsGiven(): HasMany
    {
        return $this->hasMany(Rating::class, 'rater_id');
    }

    /**
     * Recompute the cached score for one role from the ratings themselves.
     *
     * The averages on this table exist so a profile or a search result renders
     * without aggregating. Recomputing from source rather than nudging a
     * running average means a deleted or corrected rating can never leave the
     * number drifting away from what the ratings actually say.
     */
    public function recalculateReputation(RatedRole $role): void
    {
        $ratings = $this->ratingsReceived()->where('ratee_role', $role->value);

        $count = (clone $ratings)->count();
        $average = $count > 0 ? round((clone $ratings)->avg('stars'), 2) : null;

        $this->forceFill($role === RatedRole::Driver
            ? ['rating_as_driver' => $average, 'ratings_as_driver_count' => $count]
            : ['rating_as_passenger' => $average, 'ratings_as_passenger_count' => $count]
        )->save();
    }

    // Trust layer

    public function hasVerifiedPhone(): bool
    {
        return $this->phone_verified_at !== null;
    }

    public function hasVerifiedIdentity(): bool
    {
        return $this->identity_verified_at !== null;
    }

    /**
     * Whether this user may publish trips. Driving is gated on identity *and*
     * a verified vehicle a verified ID alone is not enough.
     */
    public function canDrive(): bool
    {
        return $this->hasVerifiedPhone()
            && $this->hasVerifiedIdentity()
            && $this->vehicles()->where('status', VerificationStatus::Approved->value)->exists();
    }
}
