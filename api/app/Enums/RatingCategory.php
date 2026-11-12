<?php

namespace App\Enums;

/**
 * The six things a rating can be about.
 *
 * Tags are grouped under these rather than offered as one flat list, because
 * the point of collecting them is to end up with a profile that reads
 * "Smooth driving 96%, Usually on time 93%" - a percentage only means
 * something when it's a share of one category, not of everything ever said.
 */
enum RatingCategory: string
{
    case Driving = 'driving';
    case Reliability = 'reliability';
    case Communication = 'communication';
    case Vehicle = 'vehicle';
    case Behaviour = 'behaviour';
    case TripAccuracy = 'trip_accuracy';

    public function label(): string
    {
        return match ($this) {
            self::Driving => 'Driving',
            self::Reliability => 'Reliability',
            self::Communication => 'Communication',
            self::Vehicle => 'Vehicle',
            self::Behaviour => 'Behaviour',
            self::TripAccuracy => 'Trip accuracy',
        };
    }

    public function emoji(): string
    {
        return match ($this) {
            self::Driving => '🚗',
            self::Reliability => '⏰',
            self::Communication => '💬',
            self::Vehicle => '🧼',
            self::Behaviour => '🤝',
            self::TripAccuracy => '📍',
        };
    }
}
