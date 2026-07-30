<?php

namespace App\Enums;

/**
 * Which side of a completed trip the person being rated was on.
 * A user carries a separate score for each role.
 */
enum RatedRole: string
{
    case Driver = 'driver';
    case Passenger = 'passenger';
}
