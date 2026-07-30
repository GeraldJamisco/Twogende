<?php

namespace Database\Factories;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Booking>
 */
class BookingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'trip_id' => Trip::factory(),
            'passenger_id' => User::factory(),
            'seats' => 1,
            // Snapshot the trip's contribution as it stands at request time.
            'contribution_per_seat' => fn (array $attributes) => Trip::find($attributes['trip_id'])->contribution_per_seat,
            'total_contribution' => fn (array $attributes) => Trip::find($attributes['trip_id'])->contribution_per_seat * $attributes['seats'],
            'status' => BookingStatus::Pending,
        ];
    }

    public function accepted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BookingStatus::Accepted,
            'responded_at' => now(),
        ]);
    }
}
