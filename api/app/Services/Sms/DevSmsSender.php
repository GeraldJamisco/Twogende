<?php

namespace App\Services\Sms;

use App\Contracts\SmsSender;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Development driver that keeps an outbox.
 *
 * OTPs are stored hashed, so there is no way to read a code back out of the
 * database by design. Rather than weaken that, the *gateway* remembers what
 * it sent, which is exactly what a real SMS provider's dashboard would show.
 * The dev console reads this outbox so you can verify a number without
 * digging through the log.
 */
class DevSmsSender implements SmsSender
{
    private const CACHE_KEY = 'dev:sms-outbox';

    private const KEEP = 25;

    public function send(string $to, string $message): void
    {
        Log::info('SMS', ['to' => $to, 'message' => $message]);

        $outbox = self::outbox();

        array_unshift($outbox, [
            'to' => $to,
            'message' => $message,
            'sent_at' => now()->toIso8601String(),
            'code' => self::extractCode($message),
        ]);

        Cache::put(self::CACHE_KEY, array_slice($outbox, 0, self::KEEP), now()->addHours(6));
    }

    /**
     * @return list<array{to: string, message: string, sent_at: string, code: ?string}>
     */
    public static function outbox(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }

    public static function clear(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Pull the code out of the message body so the console can offer a
     * one-click "use this code".
     */
    private static function extractCode(string $message): ?string
    {
        $length = (int) config('twogende.otp.length');

        return preg_match('/\b(\d{'.$length.'})\b/', $message, $matches) === 1
            ? $matches[1]
            : null;
    }
}
