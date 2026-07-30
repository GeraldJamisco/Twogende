<?php

namespace App\Enums;

enum TripStatus: string
{
    case Scheduled = 'scheduled';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /**
     * Only scheduled trips may be searched for or requested.
     */
    public function acceptsBookings(): bool
    {
        return $this === self::Scheduled;
    }
}
