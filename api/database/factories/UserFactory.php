<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            // mobile numbers in E.164: +256 7XX XXXXXX.
            'phone' => '+2567'.fake()->unique()->numerify('########'),
            'phone_verified_at' => now(),
            'email' => null,
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * A freshly registered user who hasn't entered their OTP yet.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'phone_verified_at' => null,
        ]);
    }

    /**
     * Passed identity checks. Still needs a verified vehicle before they can
     * publish trips see User::canDrive().
     */
    public function identityVerified(): static
    {
        return $this->state(fn (array $attributes) => [
            'identity_verified_at' => now(),
        ]);
    }
}
