<?php

namespace App\Models;

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
 * `name` is the *display* name — whatever this person chose to be called, very
 * often a nickname. It is what appears on trip cards, profiles and greetings.
 *
 * It is deliberately not their legal name. That is captured separately, during
 * identity verification, as identity_verifications.full_name_on_document, and
 * is used only to check somebody is who they say they are. Never render it.
 */
#[Fillable(['name', 'email', 'photo_path', 'bio'])]
#[Hidden(['remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

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
