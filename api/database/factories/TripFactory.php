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
     * Real coordinates for the routes the starting wedge actually covers, so
     * radius matching in tests behaves like it will in Kampala.
     *
     * @var array<string, array{0: float, 1: float}>
     */
    public const PLACES = [
        'Kampala CBD' => [0.3136, 32.5811],
        'Ntinda' => [0.3563, 32.6103],
        'Kireka' => [0.3444, 32.6547],
        'Nansana' => [0.3667, 32.5286],
        'Wakiso' => [0.4044, 32.4594],
        'Entebbe' => [0.0512, 32.4633],
        'Mukono' => [0.3533, 32.7553],
        'Jinja' => [0.4244, 33.2041],
        'Mbarara' => [-0.6072, 30.6545],
    ];

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $seats = fake()->numberBetween(1, 4);

        $names = array_keys(self::PLACES);
        [$origin, $destination] = fake()->randomElements($names, 2);

        return [
            'vehicle_id' => Vehicle::factory()->verified(),
            // Keep the trip's driver and the vehicle's owner the same person.
            'driver_id' => fn (array $attributes) => Vehicle::find($attributes['vehicle_id'])->user_id,

            'origin_name' => $origin,
            'origin_place_id' => self::placeId($origin),
            'origin_lat' => self::PLACES[$origin][0],
            'origin_lng' => self::PLACES[$origin][1],

            'destination_name' => $destination,
            'destination_place_id' => self::placeId($destination),
            'destination_lat' => self::PLACES[$destination][0],
            'destination_lng' => self::PLACES[$destination][1],

            'departure_at' => fake()->dateTimeBetween('+1 hour', '+2 weeks'),
            'seats_total' => $seats,
            'seats_available' => $seats,
            // Typical Kampala commuter contribution, in whole shillings.
            'contribution_per_seat' => fake()->numberBetween(2, 20) * 1000,
            'status' => TripStatus::Scheduled,
        ];
    }

    /** Stand-in for a Google place identifier, stable per place name. */
    public static function placeId(string $name): string
    {
        return 'place_'.str_replace(' ', '_', strtolower($name));
    }

    public function withSeats(int $seats): static
    {
        return $this->state(fn (array $attributes) => [
            'seats_total' => $seats,
            'seats_available' => $seats,
        ]);
    }

    public function from(string $place): static
    {
        return $this->state(fn (array $attributes) => [
            'origin_name' => $place,
            'origin_place_id' => self::placeId($place),
            'origin_lat' => self::PLACES[$place][0],
            'origin_lng' => self::PLACES[$place][1],
        ]);
    }

    public function to(string $place): static
    {
        return $this->state(fn (array $attributes) => [
            'destination_name' => $place,
            'destination_place_id' => self::placeId($place),
            'destination_lat' => self::PLACES[$place][0],
            'destination_lng' => self::PLACES[$place][1],
        ]);
    }

    public function departingAt(string $when): static
    {
        return $this->state(fn (array $attributes) => ['departure_at' => $when]);
    }
}
