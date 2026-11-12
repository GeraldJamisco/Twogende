<?php

namespace Tests\Feature\Auth;

use App\Contracts\SmsSender;
use App\Services\Sms\AfricasTalkingSmsSender;
use App\Services\Sms\LogSmsSender;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * The Africa's Talking driver.
 *
 * The failure that matters most here is the quiet one: the API answers 201
 * and still refuses the message. A driver that only checked the HTTP status
 * would report an OTP as sent that never left the building.
 */
class AfricasTalkingSmsTest extends TestCase
{
    private function configure(array $overrides = []): void
    {
        config(['twogende.sms.africastalking' => array_merge([
            'username' => 'twogende',
            'api_key' => 'key-123',
            'sender_id' => null,
            'sandbox' => false,
        ], $overrides)]);
    }

    private function accepted(int $statusCode = 101): array
    {
        return [
            'SMSMessageData' => [
                'Message' => 'Sent to 1/1 Total Cost: UGX 25.0000',
                'Recipients' => [[
                    'statusCode' => $statusCode,
                    'number' => '+256701234567',
                    'status' => 'Success',
                    'messageId' => 'ATXid_abc',
                ]],
            ],
        ];
    }

    public function test_a_code_is_posted_to_the_live_endpoint(): void
    {
        $this->configure();
        Http::fake(['*' => Http::response($this->accepted(), 201)]);

        (new AfricasTalkingSmsSender)->send('+256701234567', 'Your code is 123456');

        Http::assertSent(function ($request) {
            $this->assertSame('key-123', $request->header('apiKey')[0]);

            return $request->url() === 'https://api.africastalking.com/version1/messaging'
                && $request['to'] === '+256701234567'
                && $request['message'] === 'Your code is 123456'
                && $request['username'] === 'twogende'
                // No sender ID configured, so none is sent - an unapproved
                // one would be rejected rather than ignored.
                && ! isset($request['from']);
        });
    }

    public function test_the_sandbox_is_a_different_host(): void
    {
        $this->configure(['sandbox' => true, 'username' => 'sandbox']);
        Http::fake(['*' => Http::response($this->accepted(), 201)]);

        (new AfricasTalkingSmsSender)->send('+256701234567', 'code');

        Http::assertSent(
            fn ($request) => $request->url() === 'https://api.sandbox.africastalking.com/version1/messaging'
        );
    }

    public function test_an_approved_sender_id_is_sent_when_there_is_one(): void
    {
        $this->configure(['sender_id' => 'Twogende']);
        Http::fake(['*' => Http::response($this->accepted(), 201)]);

        (new AfricasTalkingSmsSender)->send('+256701234567', 'code');

        Http::assertSent(fn ($request) => $request['from'] === 'Twogende');
    }

    #[DataProvider('acceptedCodes')]
    public function test_processed_sent_and_queued_all_count_as_delivered(int $code): void
    {
        $this->configure();
        Http::fake(['*' => Http::response($this->accepted($code), 201)]);

        (new AfricasTalkingSmsSender)->send('+256701234567', 'code');

        $this->assertTrue(true); // no exception is the assertion
    }

    public static function acceptedCodes(): array
    {
        return ['processed' => [100], 'sent' => [101], 'queued' => [102]];
    }

    public function test_a_rejection_hidden_behind_a_201_still_fails(): void
    {
        $this->configure();

        // 405 is InsufficientBalance - the account is empty. The HTTP call
        // succeeds; the message goes nowhere.
        Http::fake(['*' => Http::response([
            'SMSMessageData' => [
                'Message' => 'Sent to 0/1 Total Cost: 0',
                'Recipients' => [[
                    'statusCode' => 405,
                    'number' => '+256701234567',
                    'status' => 'InsufficientBalance',
                ]],
            ],
        ], 201)]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/InsufficientBalance/');

        (new AfricasTalkingSmsSender)->send('+256701234567', 'code');
    }

    public function test_an_empty_recipient_list_fails_rather_than_passing_silently(): void
    {
        $this->configure();
        Http::fake(['*' => Http::response([
            'SMSMessageData' => ['Message' => 'Invalid sender id', 'Recipients' => []],
        ], 201)]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/no recipients/i');

        (new AfricasTalkingSmsSender)->send('+256701234567', 'code');
    }

    public function test_missing_credentials_fail_before_any_request_is_made(): void
    {
        $this->configure(['api_key' => '']);
        Http::fake();

        try {
            (new AfricasTalkingSmsSender)->send('+256701234567', 'code');
            $this->fail('Expected a failure when the API key is missing.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('AT_API_KEY', $e->getMessage());
        }

        Http::assertNothingSent();
    }

    public function test_the_driver_is_only_used_when_it_is_selected(): void
    {
        config(['twogende.sms.driver' => 'log']);
        $this->assertInstanceOf(LogSmsSender::class, app(SmsSender::class));

        // A typo in SMS_DRIVER must not silently do nothing - it logs.
        config(['twogende.sms.driver' => 'africas-talking']);
        $this->assertInstanceOf(LogSmsSender::class, app(SmsSender::class));

        config(['twogende.sms.driver' => 'africastalking']);
        $this->assertInstanceOf(AfricasTalkingSmsSender::class, app(SmsSender::class));
    }
}
