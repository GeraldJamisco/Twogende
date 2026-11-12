<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\PlacesProvider;
use App\Http\Controllers\Controller;
use App\Support\PlaceSuggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Proxies Google Places so the API key stays on the server.
 *
 * Authenticated and throttled: every call here costs money, and an open proxy
 * is somebody else's free geocoder.
 */
class PlaceController extends Controller
{
    public function __construct(private readonly PlacesProvider $places) {}

    public function autocomplete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:120'],
            // Google bills a whole autocomplete session as one unit when the
            // keystrokes share a token and the details call closes it. The app
            // generates the token; we just pass it through.
            'session_token' => ['sometimes', 'string', 'max:64'],
        ]);

        $suggestions = $this->places->suggest(
            $validated['query'],
            $validated['session_token'] ?? null,
        );

        return response()->json([
            'data' => array_map(fn (PlaceSuggestion $s) => $s->toArray(), $suggestions),
        ]);
    }

    /**
     * Turn a GPS fix into a named place - what "My current location" resolves
     * to on the search screen.
     *
     * A bare coordinate can't be matched against a trip by identifier, so the
     * handset's position has to become a real place before it's useful as a
     * search origin.
     */
    public function nearest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $place = $this->places->nearest(
            (float) $validated['latitude'],
            (float) $validated['longitude'],
        );

        if (! $place) {
            return response()->json([
                'message' => 'We could not work out where you are. Please choose a place instead.',
            ], 404);
        }

        return response()->json(['data' => $place->toArray()]);
    }

    /**
     * Resolve a chosen suggestion to coordinates. The app sends the result
     * straight back when creating a trip or running a search.
     */
    public function show(Request $request, string $placeId): JsonResponse
    {
        $validated = $request->validate([
            'session_token' => ['sometimes', 'string', 'max:64'],
        ]);

        $place = $this->places->details($placeId, $validated['session_token'] ?? null);

        if (! $place) {
            return response()->json(['message' => 'That place could not be found.'], 404);
        }

        return response()->json(['data' => $place->toArray()]);
    }
}
