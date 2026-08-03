<?php

namespace App\Support;

/**
 * Great-circle distance, for comparing two positions in PHP.
 *
 * The equivalent SQL lives in Trip::withinRadius() for filtering whole result
 * sets; this is for the one-off "how far is the driver from the passenger"
 * check that decides whether they've arrived.
 */
final class Distance
{
    private const EARTH_RADIUS_METRES = 6_371_000;

    public static function metresBetween(
        float $latitudeA,
        float $longitudeA,
        float $latitudeB,
        float $longitudeB,
    ): float {
        $latA = deg2rad($latitudeA);
        $latB = deg2rad($latitudeB);
        $deltaLat = deg2rad($latitudeB - $latitudeA);
        $deltaLng = deg2rad($longitudeB - $longitudeA);

        $a = sin($deltaLat / 2) ** 2
            + cos($latA) * cos($latB) * sin($deltaLng / 2) ** 2;

        // Clamped: floating point can push this a hair over 1 for identical
        // points, and asin() would then return NAN.
        return self::EARTH_RADIUS_METRES * 2 * asin(min(1.0, sqrt($a)));
    }
}
