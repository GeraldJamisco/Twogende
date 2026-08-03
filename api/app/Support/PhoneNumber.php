<?php

namespace App\Support;

/**
 * mobile numbers, reduced to one canonical form.
 *
 * People type their number every way imaginable 0701 234 567, 701234567,
 * 256701234567, +256-701-234-567. All of those are the same person, and the
 * unique constraint on users.phone only means something if they all collapse
 * to the same string before they reach the database.
 */
final class PhoneNumber
{
    /**
     * Reduce any accepted spelling to E.164, or null if it isn't a valid
     * mobile number.
     */
    public static function normalise(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $countryCode = (string) config('twogende.phone.country_code');
        $prefix = (string) config('twogende.phone.mobile_prefix');
        $length = (int) config('twogende.phone.national_digits');

        // Strip everything that isn't a digit: spaces, dashes, brackets, and
        // the leading plus (the country code that follows is enough).
        $digits = preg_replace('/\D+/', '', $input) ?? '';

        // Drop leading zeros before anything else. That covers both the
        // national trunk prefix (0701…) and the international dialling prefix
        // (00256701…) in one step mobile numbers never start with a
        // zero once those are gone.
        $digits = ltrim($digits, '0');

        $national = str_starts_with($digits, $countryCode)
            ? substr($digits, strlen($countryCode))
            : $digits;

        if (strlen($national) !== $length || ! str_starts_with($national, $prefix)) {
            return null;
        }

        return '+'.$countryCode.$national;
    }

    public static function isValid(?string $input): bool
    {
        return self::normalise($input) !== null;
    }

    /**
     * How the number is shown back to the user: 0701 234 567.
     */
    public static function forDisplay(string $e164): string
    {
        $countryCode = (string) config('twogende.phone.country_code');
        $national = substr($e164, strlen($countryCode) + 1);

        if (strlen($national) !== (int) config('twogende.phone.national_digits')) {
            return $e164;
        }

        return '0'.substr($national, 0, 3).' '.substr($national, 3, 3).' '.substr($national, 6);
    }

    /**
     * Partially masked, for "we sent a code to ..." copy.
     */
    public static function masked(string $e164): string
    {
        return substr($e164, 0, 7).str_repeat('*', max(0, strlen($e164) - 9)).substr($e164, -2);
    }
}
