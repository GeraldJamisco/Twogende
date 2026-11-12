<?php

namespace App\Services\Sms;

use App\Contracts\SmsSender;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Africa's Talking, which is the gateway that actually reaches a Ugandan
 * handset without a month of paperwork.
 *
 * Throwing on failure is deliberate: SmsChannel catches it, logs it and lets
 * ChannelRouter fall through to the next channel. A sender that swallowed the
 * error would report a code as delivered that never left the building, and
 * the user would sit waiting for an SMS that is never coming.
 */
class AfricasTalkingSmsSender implements SmsSender
{
    /**
     * Status codes Africa's Talking uses for "we have it and it is on its
     * way". Anything else is a failure, including the ones that look benign.
     *
     * 100 Processed · 101 Sent · 102 Queued
     */
    private const ACCEPTED = [100, 101, 102];

    public function send(string $to, string $message): void
    {
        $config = config('twogende.sms.africastalking');

        $username = (string) ($config['username'] ?? '');
        $apiKey = (string) ($config['api_key'] ?? '');

        if ($username === '' || $apiKey === '') {
            throw new RuntimeException(
                'Africa\'s Talking is selected as the SMS driver but AT_USERNAME or AT_API_KEY is missing.'
            );
        }

        $response = Http::asForm()
            ->withHeaders([
                'apiKey' => $apiKey,
                'Accept' => 'application/json',
            ])
            ->timeout(15)
            // One retry, because a code that fails on a blip is a user typing
            // their number again. Not more: a duplicated SMS costs money and
            // confuses somebody holding two different codes.
            ->retry(2, 300, throw: false)
            ->post($this->endpoint($config), array_filter([
                'username' => $username,
                'to' => $to,
                'message' => $message,

                /*
                 * Only sent when one is configured. An alphanumeric sender ID
                 * has to be registered with Africa's Talking first, and
                 * sending an unapproved one is rejected outright (402) rather
                 * than quietly falling back to the shared short code.
                 */
                'from' => $config['sender_id'] ?: null,
            ], fn ($value) => $value !== null && $value !== ''));

        if ($response->failed()) {
            throw new RuntimeException(sprintf(
                "Africa's Talking returned HTTP %d: %s",
                $response->status(),
                $response->body(),
            ));
        }

        $this->assertAccepted($response->json(), $to);
    }

    /**
     * The HTTP call can succeed while the message is refused - a bad number,
     * an unapproved sender ID, or an empty account all come back 201 with the
     * refusal buried in the recipient list.
     *
     * @param  array<string, mixed>|null  $body
     */
    private function assertAccepted(?array $body, string $to): void
    {
        $recipients = $body['SMSMessageData']['Recipients'] ?? [];

        if ($recipients === []) {
            // No recipients at all means it was rejected before delivery was
            // ever attempted. The Message line carries the reason.
            throw new RuntimeException(sprintf(
                "Africa's Talking accepted no recipients for %s: %s",
                $to,
                $body['SMSMessageData']['Message'] ?? 'no reason given',
            ));
        }

        foreach ($recipients as $recipient) {
            $code = (int) ($recipient['statusCode'] ?? 0);

            if (! in_array($code, self::ACCEPTED, true)) {
                throw new RuntimeException(sprintf(
                    "Africa's Talking rejected %s: %s (status %d)",
                    $recipient['number'] ?? $to,
                    $recipient['status'] ?? 'unknown',
                    $code,
                ));
            }
        }
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function endpoint(array $config): string
    {
        // The sandbox is a separate host and takes the literal username
        // "sandbox". Nothing sent to it reaches a real handset, which is what
        // makes it safe to point staging at.
        return ($config['sandbox'] ?? false)
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : 'https://api.africastalking.com/version1/messaging';
    }
}
