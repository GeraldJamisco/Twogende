<?php

namespace Database\Factories;

use App\Enums\TripStatus;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Trip>
 */
class TripFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $seats = fake()->numberBetween(1, 4);

        $places = ['Ntinda', 'Kireka', 'Nansana', 'Entebbe', 'Mukono', 'Kampala CBD', 'Wakiso'];
        [$origin, $destination] = fake()->randomElements($places, 2);

        return [
            'vehicle_id' => Vehicle::factory()->verified(),
            // Keep the trip's driver and the vehicle's owner the same person.
            'driver_id' => fn (array $attributes) => Vehicle::find($attributes['vehicle_id'])->user_id,
            'origin_name' => $origin,
            'destination_name' => $destination,
            'departure_at' => fake()->dateTimeBetween('+1 hour', '+2 weeks'),
            'seats_total' => $seats,
            'seats_available' => $seats,
            // Typical Kampala commuter contribution, in whole shillings.
            'contribution_per_seat' => fake()->numberBetween(2, 20) * 1000,
            'status' => TripStatus::Scheduled,
        ];
    }

    public function withSeats(int $seats): static
    {
        return $this->state(fn (array $attributes) => [
            'seats_total' => $seats,
            'seats_available' => $seats,
        ]);
    }
}
