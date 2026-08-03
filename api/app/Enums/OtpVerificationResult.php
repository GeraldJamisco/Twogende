<?php

namespace App\Enums;

enum OtpVerificationResult: string
{
    case Verified = 'verified';
    case Incorrect = 'incorrect';
    case Expired = 'expired';
    case TooManyAttempts = 'too_many_attempts';
    case NotFound = 'not_found';

    /**
     * Wording shown to the user. "Incorrect" and "not found" read the same on
     * purpose neither should confirm whether a code was ever issued.
     */
    public function message(): string
    {
        return match ($this) {
            self::Verified => 'Phone number verified.',
            self::Incorrect, self::NotFound => 'That code is not correct. Please check and try again.',
            self::Expired => 'That code has expired. Request a new one.',
            self::TooManyAttempts => 'Too many incorrect attempts. Request a new code.',
        };
    }
}
