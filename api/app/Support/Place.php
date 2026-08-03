<?php

namespace App\Support;

/**
 * A place as the app knows it: Google's stable identifier plus the name and
 * coordinates we store on a trip.
 */
final readonly class Place
{
    public function __construct(
        public string $placeId,
        /** Short label, e.g. "Ntinda". */
        public string $name,
        /** Full label, e.g. "Ntinda, Kampala, Uganda". */
        public string $address,
        public float $latitude,
        public float $longitude,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            placeId: (string) $data['place_id'],
            name: (string) $data['name'],
            address: (string) $data['address'],
            latitude: (float) $data['latitude'],
            longitude: (float) $data['longitude'],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'place_id' => $this->placeId,
            'name' => $this->name,
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
        ];
    }
}
