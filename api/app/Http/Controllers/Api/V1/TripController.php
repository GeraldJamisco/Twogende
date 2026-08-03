<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Trip\SearchTripsRequest;
use App\Http\Requests\Trip\StoreTripRequest;
use App\Http\Resources\TripResource;
use App\Models\Trip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class TripController extends Controller
{
    /**
     * Search, and with no place filters the home feed.
     *
     * Both are the same query: bookable trips, soonest first. The home screen
     * simply calls it without an origin or destination.
     */
    public function index(SearchTripsRequest $request): AnonymousResourceCollection
    {
        $query = Trip::query()
            ->bookable()
            ->withSeatsFor($request->seats())
            ->with(['driver', 'vehicle'])
            ->withMyBooking($request->user());

        // "Lowest price" still breaks ties by departure — of two equally cheap
        // rides, the sooner one is the more useful answer.
        match ($request->sort()) {
            'price' => $query->orderBy('contribution_per_seat')->orderBy('departure_at'),
            default => $query->orderBy('departure_at'),
        };

        if ($request->filled('origin_place_id')) {
            $query->fromPlace(
                $request->string('origin_place_id')->toString(),
                $request->has('origin_latitude') ? (float) $request->input('origin_latitude') : null,
                $request->has('origin_longitude') ? (float) $request->input('origin_longitude') : null,
            );
        }

        if ($request->filled('destination_place_id')) {
            $query->toPlace(
                $request->string('destination_place_id')->toString(),
                $request->has('destination_latitude') ? (float) $request->input('destination_latitude') : null,
                $request->has('destination_longitude') ? (float) $request->input('destination_longitude') : null,
            );
        }

        if ($request->filled('date')) {
            $query->departingOn(Carbon::parse($request->string('date')->toString()));
        }

        // Applied after the day filter so the two compose: "today, but not
        // before 4pm".
        if ($request->filled('after')) {
            $query->where('departure_at', '>=', Carbon::parse($request->string('after')->toString()));
        }

        // A driver shouldn't see their own trips in a passenger search.
        $query->where('driver_id', '!=', $request->user()->getKey());

        return TripResource::collection($query->paginate($request->perPage())->withQueryString());
    }

    /**
     * What other drivers are asking on this route.
     *
     * Backs the "Suggested USh 12k–18k" line when posting a ride. Derived from
     * real trips rather than a guess: a made-up range would anchor drivers to a
     * number nobody has ever actually paid.
     *
     * Returns null below a handful of trips — a "suggestion" drawn from one or
     * two data points is noise dressed up as guidance, and the screen hides the
     * line rather than show it.
     */
    public function priceSuggestion(SearchTripsRequest $request): JsonResponse
    {
        $minimumSample = (int) config('twogende.trips.price_suggestion_minimum');

        $query = Trip::query()
            // Free lifts are a real choice but they'd drag the range to zero.
            ->where('contribution_per_seat', '>', 0);

        if ($request->filled('origin_place_id')) {
            $query->fromPlace(
                $request->string('origin_place_id')->toString(),
                $request->has('origin_latitude') ? (float) $request->input('origin_latitude') : null,
                $request->has('origin_longitude') ? (float) $request->input('origin_longitude') : null,
            );
        }

        if ($request->filled('destination_place_id')) {
            $query->toPlace(
                $request->string('destination_place_id')->toString(),
                $request->has('destination_latitude') ? (float) $request->input('destination_latitude') : null,
                $request->has('destination_longitude') ? (float) $request->input('destination_longitude') : null,
            );
        }

        $fares = $query->orderBy('contribution_per_seat')
            ->pluck('contribution_per_seat')
            ->all();

        if (count($fares) < $minimumSample) {
            return response()->json(['data' => null, 'sample_size' => count($fares)]);
        }

        // Quartiles rather than min and max, so one unusually cheap or
        // expensive trip doesn't define the whole range.
        return response()->json([
            'data' => [
                'low' => $this->quantile($fares, 0.25),
                'high' => $this->quantile($fares, 0.75),
                'currency' => 'UGX',
            ],
            'sample_size' => count($fares),
        ]);
    }

    /**
     * @param  list<int>  $sorted
     */
    private function quantile(array $sorted, float $fraction): int
    {
        $index = (int) round($fraction * (count($sorted) - 1));

        return (int) $sorted[$index];
    }

    /**
     * Trips this user is driving, newest first. Includes finished ones.
     */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $trips = Trip::query()
            ->where('driver_id', $request->user()->getKey())
            ->with(['vehicle', 'driver'])
            ->withCount([
                'bookings as pending_bookings_count' => fn ($q) => $q->where('status', BookingStatus::Pending),
                'bookings as accepted_bookings_count' => fn ($q) => $q->where('status', BookingStatus::Accepted),
            ])
            ->orderByDesc('departure_at')
            ->paginate(20);

        return TripResource::collection($trips);
    }

    public function show(Request $request, Trip $trip): TripResource
    {
        $trip->load(['driver', 'vehicle']);
        $trip->loadMyBooking($request->user());

        return new TripResource($trip);
    }

    /**
     * Authorization happens in StoreTripRequest::authorize(), which runs
     * before validation see the comment there.
     */
    public function store(StoreTripRequest $request): JsonResponse
    {
        $attributes = $request->toTripAttributes();

        $trip = new Trip($attributes);

        // Assigned rather than mass-assigned. Neither of these may ever come
        // from request input: the driver is whoever holds the token, and
        // availability is derived from the seats offered, never posted.
        $trip->driver_id = $request->user()->getKey();
        $trip->seats_available = $attributes['seats_total'];
        $trip->status = TripStatus::Scheduled;
        $trip->save();

        // Picks up the columns with database defaults (currency, timestamps),
        // which aren't populated in memory by the insert.
        $trip->refresh();

        return (new TripResource($trip->load(['driver', 'vehicle'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Cancel a trip. Bookings go with it the seat is gone either way, and
     * leaving them "accepted" against a dead trip would be a lie.
     */
    public function cancel(Request $request, Trip $trip): TripResource
    {
        $this->authorize('cancel', $trip);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $trip->cancel($validated['reason'] ?? null);

        return new TripResource($trip->load(['driver', 'vehicle']));
    }

    /**
     * Mark the trip finished. This is what unlocks ratings and increments the
     * completed-trip counts on both sides.
     */
    public function complete(Request $request, Trip $trip): TripResource
    {
        $this->authorize('complete', $trip);

        $trip->complete();

        return new TripResource($trip->load(['driver', 'vehicle']));
    }

    /**
     * Kept explicit rather than a generic update: the only fields a driver may
     * change after publishing are the ones that don't rewrite a deal someone
     * already agreed to.
     */
    public function update(Request $request, Trip $trip): TripResource
    {
        $this->authorize('update', $trip);

        $validated = $request->validate([
            'departure_at' => [
                'sometimes',
                'date',
                'after:now',
                'before:'.now()->addDays((int) config('twogende.trips.max_days_ahead'))->toDateTimeString(),
            ],
            'contribution_per_seat' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $trip->update($validated);

        return new TripResource($trip->fresh()->load(['driver', 'vehicle']));
    }

    /**
     * Status transitions the driver can make on the day.
     */
    public function start(Request $request, Trip $trip): TripResource
    {
        $this->authorize('complete', $trip); // same window as completing

        $trip->forceFill(['status' => TripStatus::InProgress])->save();

        return new TripResource($trip->load(['driver', 'vehicle']));
    }
}
