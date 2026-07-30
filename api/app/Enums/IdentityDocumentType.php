<?php

namespace App\Enums;

enum IdentityDocumentType: string
{
    case NationalId = 'national_id';
    case Passport = 'passport';
    case DrivingPermit = 'driving_permit';

    /**
     * Documents that require a photo of the reverse side.
     */
    public function requiresBackImage(): bool
    {
        return $this !== self::Passport;
    }
}
