<?php

namespace App\Enums;

enum BookingStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case CancelledByPassenger = 'cancelled_by_passenger';
    case CancelledByDriver = 'cancelled_by_driver';
    case Completed = 'completed';

    /**
     * Statuses that hold a seat on the trip. Anything else releases it.
     */
    public function holdsSeat(): bool
    {
        return in_array($this, [self::Accepted, self::Completed], true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Rejected,
            self::CancelledByPassenger,
            self::CancelledByDriver,
            self::Completed,
        ], true);
    }
}
