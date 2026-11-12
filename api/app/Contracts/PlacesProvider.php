<?php

namespace App\Contracts;

use App\Support\Place;
use App\Support\PlaceSuggestion;

/**
 * The seam in front of Google Places. Everything above it deals in Place and
 * PlaceSuggestion, so swapping provider (or falling back to a local gazetteer
 * if Google's bill gets uncomfortable) doesn't reach the controllers.
 */
interface PlacesProvider
{
    /**
     * Suggestions for a partial query, biased to Uganda.
     *
     * @param  string|null  $sessionToken  Google bills autocomplete per session:
     *                                     every keystroke in one search shares a
     *                                     token, and the details lookup that
     *                                     follows closes it.
     * @return list<PlaceSuggestion>
     */
    public function suggest(string $query, ?string $sessionToken = null): array;

    /**
     * Resolve a suggestion to the name and coordinates stored on a trip.
     */
    public function details(string $placeId, ?string $sessionToken = null): ?Place;

    /**
     * The nearest named place to a coordinate - what "My current location"
     * resolves to.
     *
     * A raw latitude and longitude can't be matched against a trip by
     * identifier, so a GPS fix has to become a real place before it's useful
     * as a search origin.
     */
    public function nearest(float $latitude, float $longitude): ?Place;
}
