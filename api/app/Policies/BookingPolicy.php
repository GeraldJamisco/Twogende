<?php

namespace App\Policies;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    /** Both sides of a booking can see it; nobody else can. */
    public function view(User $user, Booking $booking): bool
    {
        return $this->isPassenger($user, $booking) || $this->isDriver($user, $booking);
    }

    /**
     * Accepting is the driver's call, and only while the request is still
     * outstanding - a rejected or cancelled booking can't be revived by
     * changing your mind later.
     */
    public function respond(User $user, Booking $booking): bool
    {
        return $this->isDriver($user, $booking)
            && $booking->status === BookingStatus::Pending;
    }

    /**
     * Either side can call it off, up until the trip is done.
     */
    /**
     * Settling the contribution is the passenger's to do. A driver marking
     * their own ride paid is not a signal anybody should trust, and letting
     * them would put a "paid" badge on a booking with no money behind it.
     */
    public function pay(User $user, Booking $booking): bool
    {
        return $user->getKey() === $booking->passenger_id;
    }

    public function cancel(User $user, Booking $booking): bool
    {
        return $this->view($user, $booking) && ! $booking->status->isTerminal();
    }

    private function isPassenger(User $user, Booking $booking): bool
    {
        return $user->getKey() === $booking->passenger_id;
    }

    private function isDriver(User $user, Booking $booking): bool
    {
        return $user->getKey() === $booking->trip->driver_id;
    }
}
