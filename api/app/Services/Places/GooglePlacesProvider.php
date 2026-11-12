<?php

namespace App\Services\Places;

use App\Contracts\PlacesProvider;
use App\Support\Place;
use App\Support\PlaceSuggestion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Google Places API (New).
 *
 * The API key lives here and only here the app calls this server, never
 * Google, so a key extracted from an APK can't run up a bill.
 */
class GooglePlacesProvider implements PlacesProvider
{
    public function suggest(string $query, ?string $sessionToken = null): array
    {
        $query = trim($query);

        if ($query === '') {
            return [];
        }

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => (string) config('services.google_places.key'),
            'Content-Type' => 'application/json',
        ])->post((string) config('services.google_places.autocomplete_url'), array_filter([
            'input' => $query,
            'includedRegionCodes' => [(string) config('twogende.places.region')],
            'locationBias' => [
                'circle' => [
                    'center' => [
                        'latitude' => (float) config('twogende.places.bias.latitude'),
                        'longitude' => (float) config('twogende.places.bias.longitude'),
                    ],
                    'radius' => (float) config('twogende.places.bias.radius_metres'),
                ],
            ],
            'sessionToken' => $sessionToken,
        ]));

        if ($response->failed()) {
            // A dead suggestion list shouldn't take the screen down with it
            // the caller renders an empty dropdown.
            Log::warning('Places autocomplete failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        }

        return collect($response->json('suggestions', []))
            ->pluck('placePrediction')
            ->filter()
            ->map(fn (array $prediction) => new PlaceSuggestion(
                placeId: (string) ($prediction['placeId'] ?? ''),
                primaryText: (string) ($prediction['structuredFormat']['mainText']['text']
                    ?? $prediction['text']['text'] ?? ''),
                secondaryText: (string) ($prediction['structuredFormat']['secondaryText']['text'] ?? ''),
            ))
            ->filter(fn (PlaceSuggestion $suggestion) => $suggestion->placeId !== '')
            ->values()
            ->all();
    }

    public function details(string $placeId, ?string $sessionToken = null): ?Place
    {
        // Coordinates for a place don't move. Cache hard this is the billed
        // call, and the same handful of Kampala stages will be picked over and
        // over.
        $cached = Cache::get($this->cacheKey($placeId));

        if (is_array($cached)) {
            return Place::fromArray($cached);
        }

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => (string) config('services.google_places.key'),
            'X-Goog-FieldMask' => 'id,displayName,formattedAddress,location',
        ])->get(
            rtrim((string) config('services.google_places.details_url'), '/').'/'.$placeId,
            array_filter(['sessionToken' => $sessionToken])
        );

        if ($response->failed()) {
            Log::warning('Places details failed', [
                'place_id' => $placeId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        }

        $latitude = $response->json('location.latitude');
        $longitude = $response->json('location.longitude');

        if ($latitude === null || $longitude === null) {
            return null;
        }

        $place = new Place(
            placeId: (string) $response->json('id', $placeId),
            name: (string) $response->json('displayName.text', ''),
            address: (string) $response->json('formattedAddress', ''),
            latitude: (float) $latitude,
            longitude: (float) $longitude,
        );

        Cache::put(
            $this->cacheKey($placeId),
            $place->toArray(),
            now()->addMinutes((int) config('twogende.places.cache_ttl_minutes'))
        );

        return $place;
    }

    /**
     * Nearest named place to a GPS fix, via Places Nearby Search.
     *
     * Cached on a coarse grid - walking a few metres shouldn't cost another
     * billed lookup.
     *
     * KNOWN LIMITATION: this answers with a nearby *business* ("African Clean
     * Energy Kampala Office") rather than the neighbourhood somebody would
     * actually name ("Ntinda"). Nearby Search only knows about points of
     * interest. Search still works - the coordinate radius in
     * Trip::scopeFromPlace matches regardless of the label - but the label
     * reads oddly.
     *
     * The fix is Google's Geocoding API, whose reverse lookup returns
     * neighbourhood and locality names with their own place IDs. It's a
     * separate API that has to be enabled on the Cloud project (as of
     * 2026-08-01 the key returns REQUEST_DENIED for it). Once enabled, try
     * geocode/json?latlng=…&result_type=neighborhood|sublocality|locality
     * first and keep this as the fallback.
     */
    public function nearest(float $latitude, float $longitude): ?Place
    {
        $cacheKey = sprintf('places:nearest:%.4f,%.4f', $latitude, $longitude);

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return Place::fromArray($cached);
        }

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => (string) config('services.google_places.key'),
            'X-Goog-FieldMask' => 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
            'Content-Type' => 'application/json',
        ])->post((string) config('services.google_places.nearby_url'), [
            // Several, not one: the closest thing to a doorway is usually the
            // building you're standing in, which is a poor place to be picked
            // up from. See pickPickupPoint().
            'maxResultCount' => 10,
            'rankPreference' => 'DISTANCE',
            'locationRestriction' => [
                'circle' => [
                    'center' => ['latitude' => $latitude, 'longitude' => $longitude],
                    'radius' => (float) config('twogende.places.nearest_radius_metres'),
                ],
            ],
        ]);

        if ($response->failed()) {
            Log::warning('Places nearby search failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        }

        $candidate = $this->pickPickupPoint((array) $response->json('places', []));

        if (! $candidate) {
            return null;
        }

        $place = new Place(
            placeId: (string) ($candidate['id'] ?? ''),
            name: (string) ($candidate['displayName']['text'] ?? ''),
            address: (string) ($candidate['formattedAddress'] ?? ''),
            latitude: (float) $candidate['location']['latitude'],
            longitude: (float) $candidate['location']['longitude'],
        );

        Cache::put($cacheKey, $place->toArray(), now()->addHours(6));

        return $place;
    }

    /**
     * Choose the most useful of the nearby results to be picked up from.
     *
     * Ranked purely by distance, Google hands back whichever building you're
     * standing next to - "African Clean Energy Kampala Office" rather than
     * "Ntinda". A driver can't find that, and it won't match anybody else's
     * search. So a stage, a stop or a landmark wins over an office, and the
     * nearest result is only the fallback.
     *
     * @param  array<int, array<string, mixed>>  $places
     * @return array<string, mixed>|null
     */
    private function pickPickupPoint(array $places): ?array
    {
        $usable = array_values(array_filter(
            $places,
            fn ($place) => is_array($place) && isset($place['location']['latitude'])
        ));

        if ($usable === []) {
            return null;
        }

        // Somewhere a driver would actually agree to stop, best first.
        $preferred = [
            'transit_station',
            'bus_station',
            'taxi_stand',
            'light_rail_station',
            'subway_station',
            'train_station',
            'shopping_mall',
            'gas_station',
            'park',
        ];

        foreach ($preferred as $type) {
            foreach ($usable as $place) {
                if (in_array($type, (array) ($place['types'] ?? []), true)) {
                    return $place;
                }
            }
        }

        return $usable[0];
    }

    private function cacheKey(string $placeId): string
    {
        return 'places:details:'.$placeId;
    }
}
