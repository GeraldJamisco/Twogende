<?php

namespace App\Policies;

use App\Enums\TripStatus;
use App\Models\Trip;
use App\Models\User;

class TripPolicy
{
    /**
     * Publishing a trip is the one action gated on the full trust stack:
     * verified phone, verified identity, and at least one approved vehicle.
     */
    public function create(User $user): bool
    {
        return $user->canDrive();
    }

    /**
     * Only the driver edits their trip, and only while it's still scheduled
     * once it's under way the details passengers agreed to are fixed.
     */
    public function update(User $user, Trip $trip): bool
    {
        return $this->owns($user, $trip) && $trip->status === TripStatus::Scheduled;
    }

    public function cancel(User $user, Trip $trip): bool
    {
        return $this->owns($user, $trip)
            && in_array($trip->status, [TripStatus::Scheduled, TripStatus::InProgress], true);
    }

    /**
     * Completing a trip is what unlocks ratings and increments trip counts, so
     * it's the driver's call and can't be made before departure.
     */
    public function complete(User $user, Trip $trip): bool
    {
        return $this->owns($user, $trip)
            && in_array($trip->status, [TripStatus::Scheduled, TripStatus::InProgress], true)
            && $trip->departure_at->isPast();
    }

    /** Seeing who has requested a seat, and accepting or rejecting them. */
    public function manageBookings(User $user, Trip $trip): bool
    {
        return $this->owns($user, $trip);
    }

    private function owns(User $user, Trip $trip): bool
    {
        return $user->getKey() === $trip->driver_id;
    }
}
