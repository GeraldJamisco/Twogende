<?php

namespace App\Enums;

/**
 * How a one-time code reaches the handset.
 *
 * WhatsApp is listed first because it's near-universal in Uganda and costs a
 * fraction of an SMS but SMS is the one that always arrives, so it's the
 * fallback rather than the other way round.
 */
enum OtpChannel: string
{
    case WhatsApp = 'whatsapp';
    case Sms = 'sms';

    public function label(): string
    {
        return match ($this) {
            self::WhatsApp => 'WhatsApp',
            self::Sms => 'SMS',
        };
    }
}
