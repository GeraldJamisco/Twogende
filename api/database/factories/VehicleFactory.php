<?php

namespace Database\Factories;

use App\Enums\VerificationStatus;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->identityVerified(),
            'make' => fake()->randomElement(['Toyota', 'Nissan', 'Honda', 'Subaru']),
            'model' => fake()->randomElement(['Wish', 'Premio', 'Noah', 'Fit', 'Forester']),
            'colour' => fake()->randomElement(['Silver', 'White', 'Black', 'Blue']),
            'year' => fake()->numberBetween(2005, 2020),
            // Ugandan plates: UAA 123A
            'plate_number' => 'U'.fake()->unique()->regexify('[A-Z]{2} [0-9]{3}[A-Z]'),
            'passenger_seats' => fake()->numberBetween(3, 6),
            'status' => VerificationStatus::Pending,
        ];
    }

    public function verified(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => VerificationStatus::Approved,
            'verified_at' => now(),
        ]);
    }
}
