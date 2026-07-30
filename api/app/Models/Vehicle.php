<?php

namespace App\Models;

use App\Enums\VerificationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'make', 'model', 'colour', 'year', 'plate_number',
    'passenger_seats', 'photo_path', 'registration_document_path',
])]
class Vehicle extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'status' => VerificationStatus::class,
            'verified_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return HasMany<Trip, $this> */
    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }

    /** @param Builder<Vehicle> $query */
    public function scopeVerified(Builder $query): void
    {
        $query->where('status', VerificationStatus::Approved);
    }

    public function isVerified(): bool
    {
        return $this->status === VerificationStatus::Approved;
    }

    /** e.g. "Silver Toyota Wish" */
    public function description(): string
    {
        return trim("{$this->colour} {$this->make} {$this->model}");
    }
}
