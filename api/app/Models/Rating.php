<?php

namespace App\Models;

use App\Enums\RatedRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['stars', 'comment', 'tags'])]
class Rating extends Model
{
    public const MIN_STARS = 1;

    public const MAX_STARS = 5;

    protected function casts(): array
    {
        return [
            'stars' => 'integer',
            'tags' => 'array',
            'ratee_role' => RatedRole::class,
        ];
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<User, $this> */
    public function rater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rater_id');
    }

    /** @return BelongsTo<User, $this> */
    public function ratee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ratee_id');
    }
}
