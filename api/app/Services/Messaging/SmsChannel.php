<?php

namespace App\Services\Messaging;

use App\Contracts\MessageChannel;
use App\Contracts\SmsSender;
use App\Enums\OtpChannel;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * SMS delivery, wrapping whichever SmsSender driver is configured.
 *
 * Always available: every handset receives SMS, which is why it's the last
 * resort in the routing order rather than the first choice.
 */
class SmsChannel implements MessageChannel
{
    public function __construct(private readonly SmsSender $sms) {}

    public function channel(): OtpChannel
    {
        return OtpChannel::Sms;
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function send(string $to, string $message): bool
    {
        try {
            $this->sms->send($to, $message);

            return true;
        } catch (Throwable $e) {
            Log::warning('SMS delivery failed', ['to' => $to, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
