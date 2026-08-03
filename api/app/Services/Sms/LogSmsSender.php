<?php

namespace App\Services\Sms;

use App\Contracts\SmsSender;
use Illuminate\Support\Facades\Log;

/**
 * Development driver: writes the message to the log so the OTP can be read
 * out of storage/logs/laravel.log instead of an actual handset.
 */
class LogSmsSender implements SmsSender
{
    public function send(string $to, string $message): void
    {
        Log::channel(config('logging.default'))->info('SMS', [
            'to' => $to,
            'from' => config('twogende.sms.sender_id'),
            'message' => $message,
        ]);
    }
}
