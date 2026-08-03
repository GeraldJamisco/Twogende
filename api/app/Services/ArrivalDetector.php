<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\MessageKind;
use App\Models\Booking;
use App\Models\Message;
use App\Models\Trip;
use App\Support\Distance;

/**
 * Works out when a driver has reached a passenger, and says so.
 *
 * Called whenever a driver reports their position. For each confirmed
 * passenger it measures against the best position it has — their live one if
 * they're sharing it and it's fresh, otherwise the pickup point they gave, and
 * failing that the trip's origin.
 *
 * Announces once per booking. Without that, a driver idling at the stage would
 * generate a message on every location ping.
 */
class ArrivalDetector
{
    /**
     * @return int How many arrivals were announced.
     */
    public function check(Trip $trip): int
    {
        if ($trip->driver_lat === null || $trip->driver_lng === null) {
            return 0;
        }

        $radius = (float) config('twogende.trips.arrival_radius_metres');
        $announced = 0;

        $bookings = $trip->bookings()
            ->where('status', BookingStatus::Accepted)
            ->whereNull('driver_arrived_at')
            ->get();

        foreach ($bookings as $booking) {
            $target = $this->waitingPointFor($booking, $trip);

            if (! $target) {
                continue;
            }

            $metres = Distance::metresBetween(
                (float) $trip->driver_lat,
                (float) $trip->driver_lng,
                $target['latitude'],
                $target['longitude'],
            );

            if ($metres > $radius) {
                continue;
            }

            $booking->forceFill(['driver_arrived_at' => now()])->save();
            $this->announce($booking, $trip);
            $announced++;
        }

        return $announced;
    }

    /**
     * Where this passenger is expected to be standing.
     *
     * A live position beats a stated pickup point, but only while it's fresh —
     * an hour-old fix is worse than the place they said they'd wait.
     *
     * @return array{latitude: float, longitude: float}|null
     */
    private function waitingPointFor(Booking $booking, Trip $trip): ?array
    {
        $freshFor = (int) config('twogende.trips.location_freshness_minutes');

        if (
            $booking->passenger_lat !== null
            && $booking->passenger_lng !== null
            && $booking->passenger_located_at?->diffInMinutes(now()) <= $freshFor
        ) {
            return [
                'latitude' => (float) $booking->passenger_lat,
                'longitude' => (float) $booking->passenger_lng,
            ];
        }

        if ($booking->pickup_lat !== null && $booking->pickup_lng !== null) {
            return [
                'latitude' => (float) $booking->pickup_lat,
                'longitude' => (float) $booking->pickup_lng,
            ];
        }

        if ($trip->origin_lat !== null && $trip->origin_lng !== null) {
            return [
                'latitude' => (float) $trip->origin_lat,
                'longitude' => (float) $trip->origin_lng,
            ];
        }

        return null;
    }

    /**
     * The "Twogende" notice in the conversation.
     *
     * Written as a system message so it renders as a notice card rather than
     * appearing to come from the driver — nobody should think their driver
     * typed this.
     */
    private function announce(Booking $booking, Trip $trip): void
    {
        $plate = $trip->vehicle?->plate_last4;

        $message = new Message([
            'body' => sprintf(
                'Ready to hop on your ride? Your driver%s is here. Please be at the pickup point soon to avoid delays.',
                $plate ? " ({$plate})" : '',
            ),
        ]);

        $message->booking_id = $booking->getKey();
        $message->kind = MessageKind::System;
        $message->sender_id = null;
        $message->save();
    }
}
