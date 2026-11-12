<?php

namespace App\Enums;

/**
 * How a passenger settles their contribution.
 *
 * Cash is the one that works today and the one nearly everybody in Kampala
 * will use. The two mobile money providers are here because the screen offers
 * them; whether either can actually be reached is a separate question, asked
 * of the gateway rather than assumed from this list.
 */
enum PaymentMethod: string
{
    case Cash = 'cash';
    case Mtn = 'mtn';
    case Airtel = 'airtel';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash payment',
            self::Mtn => 'MTN Mobile Money',
            self::Airtel => 'Airtel Money',
        };
    }

    public function note(): string
    {
        return match ($this) {
            self::Cash => 'Hand over to driver at destination',
            self::Mtn, self::Airtel => 'Paid straight to the driver',
        };
    }

    /** The provider's own name, as it appears on the phone's prompt. */
    public function provider(): ?string
    {
        return match ($this) {
            self::Cash => null,
            self::Mtn => 'MTN Mobile Money',
            self::Airtel => 'Airtel Money',
        };
    }

    /**
     * Cash never leaves the two people involved. Nothing to request, nothing
     * to approve, nothing that can fail halfway.
     */
    public function isMobileMoney(): bool
    {
        return $this !== self::Cash;
    }
}
