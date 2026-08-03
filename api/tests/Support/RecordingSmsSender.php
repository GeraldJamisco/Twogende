<?php

namespace Tests\Support;

use App\Contracts\SmsSender;
use PHPUnit\Framework\Assert;

/**
 * Captures messages instead of sending them. Tests read the OTP back out of
 * the message body rather than out of the database, because the database only
 * ever holds the hash same as production.
 */
class RecordingSmsSender implements SmsSender
{
    /** @var list<array{to: string, message: string}> */
    public array $sent = [];

    public function send(string $to, string $message): void
    {
        $this->sent[] = ['to' => $to, 'message' => $message];
    }

    public function assertSentTo(string $phone): void
    {
        Assert::assertContains($phone, array_column($this->sent, 'to'), "No SMS was sent to {$phone}.");
    }

    public function assertNothingSent(): void
    {
        Assert::assertSame([], $this->sent, 'Expected no SMS to be sent.');
    }

    public function assertSentCount(int $expected): void
    {
        Assert::assertCount($expected, $this->sent);
    }

    /**
     * The code from the most recent message, as the user would read it.
     */
    public function latestCode(): string
    {
        Assert::assertNotEmpty($this->sent, 'No SMS was sent, so there is no code to read.');

        $message = end($this->sent)['message'];
        $length = (int) config('twogende.otp.length');

        Assert::assertSame(1, preg_match('/\b(\d{'.$length.'})\b/', $message, $matches), "No {$length}-digit code found in: {$message}");

        return $matches[1];
    }

    public function latestMessage(): string
    {
        return end($this->sent)['message'];
    }
}
