<?php

namespace Tests\Support;

use App\Contracts\PlacesProvider;
use App\Support\Place;
use App\Support\PlaceSuggestion;

/**
 * Stands in for Google so tests never make a billed call.
 */
class FakePlacesProvider implements PlacesProvider
{
    /** @var list<PlaceSuggestion> */
    public array $suggestions = [];

    public ?Place $place = null;

    public ?Place $nearestPlace = null;

    /** @var list<array{latitude: float, longitude: float}> */
    public array $nearestCalls = [];

    public function suggest(string $query, ?string $sessionToken = null): array
    {
        return $this->suggestions;
    }

    public function details(string $placeId, ?string $sessionToken = null): ?Place
    {
        return $this->place;
    }

    public function nearest(float $latitude, float $longitude): ?Place
    {
        $this->nearestCalls[] = ['latitude' => $latitude, 'longitude' => $longitude];

        return $this->nearestPlace;
    }
}
