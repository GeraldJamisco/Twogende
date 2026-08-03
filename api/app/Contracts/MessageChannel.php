<?php

namespace App\Contracts;

use App\Enums\OtpChannel;

/**
 * One way of getting a message to a handset.
 *
 * Implementations report whether they're usable so the router can skip a
 * channel that has no credentials configured, rather than failing a sign-in
 * because WhatsApp hasn't been set up yet.
 */
interface MessageChannel
{
    public function channel(): OtpChannel;

    /**
     * False when this channel isn't configured or is switched off. The router
     * moves on to the next one without attempting delivery.
     */
    public function isAvailable(): bool;

    /**
     * @param  string  $to  E.164 destination number.
     * @return bool Whether the message was accepted for delivery.
     */
    public function send(string $to, string $message): bool;
}
