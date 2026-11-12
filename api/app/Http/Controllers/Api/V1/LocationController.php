<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Trip;
use App\Services\ArrivalDetector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Live position reporting, which exists for exactly one purpose: telling a
 * passenger their driver has arrived.
 *
 * Nothing here is readable. There is no endpoint that returns anybody's
 * coordinates - the only thing that comes back out is the system message the
 * proximity check generates. Positions are overwritten, never accumulated.
 */
class LocationController extends Controller
{
    public function __construct(private readonly ArrivalDetector $arrivals) {}

    /**
     * The driver reporting where they are.
     */
    public function driver(Request $request, Trip $trip): JsonResponse
    {
        abort_unless($trip->driver_id === $request->user()->getKey(), 403);

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        if (! in_array($trip->status, [TripStatus::Scheduled, TripStatus::InProgress], true)) {
            return response()->json([
                'message' => 'This trip is no longer running.',
            ], 422);
        }

        $trip->forceFill([
            'driver_lat' => $validated['latitude'],
            'driver_lng' => $validated['longitude'],
            'driver_located_at' => now(),
        ])->save();

        $announced = $this->arrivals->check($trip);

        return response()->json([
            'message' => 'Position recorded.',
            // Lets the app know a notice appeared without re-reading threads.
            'arrivals_announced' => $announced,
        ]);
    }

    /**
     * A passenger sharing where they're waiting. Optional - without it the
     * pickup point they gave is used instead.
     */
    public function passenger(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        abort_unless($booking->passenger_id === $request->user()->getKey(), 403);

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $booking->forceFill([
            'passenger_lat' => $validated['latitude'],
            'passenger_lng' => $validated['longitude'],
            'passenger_located_at' => now(),
        ])->save();

        // The driver may already be standing there.
        $this->arrivals->check($booking->trip);

        return response()->json(['message' => 'Position recorded.']);
    }
}
