<?php

namespace App\Services\Messaging;

use App\Contracts\MessageChannel;
use App\Enums\OtpChannel;
use Illuminate\Support\Facades\Log;

/**
 * Sends a message down the first channel that works.
 *
 * The order comes from config (twogende.otp.channels) and is WhatsApp before
 * SMS: WhatsApp costs a fraction of an SMS and nearly everyone in Uganda has
 * it, but not quite everyone, and a number that isn't on WhatsApp has to still
 * receive its code. Channels that aren't configured are skipped, so this
 * behaves as plain SMS until WhatsApp credentials exist.
 */
class ChannelRouter
{
    /** @param  iterable<MessageChannel>  $channels */
    public function __construct(private readonly iterable $channels) {}

    /**
     * @return OtpChannel|null The channel that accepted the message, or null
     *                         if every configured channel failed.
     */
    public function send(string $to, string $message): ?OtpChannel
    {
        $order = array_map(
            fn (string $value) => OtpChannel::from($value),
            (array) config('twogende.otp.channels', ['sms'])
        );

        $available = [];
        foreach ($this->channels as $channel) {
            $available[$channel->channel()->value] = $channel;
        }

        foreach ($order as $preference) {
            $channel = $available[$preference->value] ?? null;

            if (! $channel || ! $channel->isAvailable()) {
                continue;
            }

            if ($channel->send($to, $message)) {
                return $channel->channel();
            }

            Log::info('Falling back to the next OTP channel', [
                'failed' => $preference->value,
            ]);
        }

        return null;
    }
}
