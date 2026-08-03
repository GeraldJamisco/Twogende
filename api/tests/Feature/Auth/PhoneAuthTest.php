<?php

namespace Tests\Feature\Auth;

use App\Contracts\SmsSender;
use App\Enums\OtpChannel;
use App\Models\PhoneVerificationCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\Support\RecordingSmsSender;
use Tests\TestCase;

/**
 * A phone number is the only credential. Requesting a code and verifying it is
 * the whole of both signing in and signing up.
 */
class PhoneAuthTest extends TestCase
{
    use RefreshDatabase;

    private RecordingSmsSender $sms;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sms = new RecordingSmsSender;
        $this->app->instance(SmsSender::class, $this->sms);

        // Rate limiter state lives in the cache and would otherwise leak
        // between tests in the same process.
        Cache::flush();
    }

    private function requestCode(string $phone = '0701234567'): string
    {
        $this->postJson('/api/v1/auth/otp', ['phone' => $phone])->assertOk();

        return $this->sms->latestCode();
    }

    public function test_a_code_can_be_requested_for_any_valid_number(): void
    {
        $this->postJson('/api/v1/auth/otp', ['phone' => '0701234567'])
            ->assertOk()
            ->assertJsonPath('phone', '+256701234567')
            ->assertJsonPath('channel', 'sms');

        $this->sms->assertSentTo('+256701234567');
    }

    public function test_requesting_a_code_creates_no_account(): void
    {
        $this->requestCode();

        // The account appears only once control of the number is proven.
        $this->assertDatabaseCount('users', 0);
    }

    public function test_the_response_does_not_reveal_whether_the_number_is_registered(): void
    {
        User::factory()->create(['phone' => '+256701234567']);

        $known = $this->postJson('/api/v1/auth/otp', ['phone' => '0701234567'])->assertOk();
        Cache::flush();
        $unknown = $this->postJson('/api/v1/auth/otp', ['phone' => '0788888888'])->assertOk();

        // Otherwise this endpoint becomes a way to test which numbers have
        // Twogende accounts.
        $this->assertSame(
            $known->json('message') === null,
            $unknown->json('message') === null,
        );
        $known->assertJsonMissingPath('is_new');
        $unknown->assertJsonMissingPath('is_new');
    }

    public function test_verifying_a_new_number_creates_the_account_and_signs_in(): void
    {
        $code = $this->requestCode();

        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '0701234567',
            'code' => $code,
        ]);

        $response->assertOk()
            ->assertJsonPath('is_new', true)
            ->assertJsonPath('user.profile_complete', false)
            ->assertJsonPath('user.verification.phone', true)
            ->assertJsonStructure(['token']);

        $user = User::query()->sole();
        $this->assertSame('+256701234567', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
        $this->assertNull($user->name, 'A new account has no name until the profile step.');
    }

    public function test_verifying_a_known_number_signs_in_without_creating_a_second_account(): void
    {
        $existing = User::factory()->create(['phone' => '+256701234567', 'name' => 'Achen Grace']);
        $code = $this->requestCode();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->assertOk()
            ->assertJsonPath('is_new', false)
            ->assertJsonPath('user.id', $existing->id)
            ->assertJsonPath('user.profile_complete', true);

        $this->assertSame(1, User::query()->count());
    }

    public function test_the_token_returned_actually_works(): void
    {
        $code = $this->requestCode();
        $token = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->json('token');

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.phone', '+256701234567');
    }

    public function test_a_new_user_sets_their_name_through_the_profile_endpoint(): void
    {
        $code = $this->requestCode();
        $token = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->json('token');

        $this->withToken($token)->patchJson('/api/v1/me', ['name' => 'Achen Grace'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Achen Grace')
            ->assertJsonPath('data.profile_complete', true);
    }

    public function test_the_same_number_typed_differently_is_the_same_account(): void
    {
        $code = $this->requestCode('0701234567');
        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])->assertOk();

        // The cooldown is measured from the last code row, not the cache, so
        // clearing the rate limiter alone isn't enough here.
        Cache::flush();
        $this->travel((int) config('twogende.otp.resend_cooldown_seconds') + 1)->seconds();

        $code = $this->requestCode('+256 701 234 567');
        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '256701234567', 'code' => $code])
            ->assertOk()
            ->assertJsonPath('is_new', false);

        $this->assertSame(1, User::query()->count());
    }

    public function test_the_code_is_only_ever_stored_hashed(): void
    {
        $code = $this->requestCode();
        $record = PhoneVerificationCode::query()->sole();

        $this->assertNotSame($code, $record->code_hash);
        $this->assertTrue(Hash::check($code, $record->code_hash));
        $this->assertSame(OtpChannel::Sms, $record->channel);
    }

    public function test_a_wrong_code_is_refused_and_costs_an_attempt(): void
    {
        $code = $this->requestCode();

        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '0701234567',
            'code' => $this->wrongCode($code),
        ])->assertStatus(422)->assertJsonPath('reason', 'incorrect');

        $this->assertSame(1, PhoneVerificationCode::query()->sole()->attempts);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_a_code_burns_out_after_repeated_wrong_guesses(): void
    {
        $code = $this->requestCode();
        $wrong = $this->wrongCode($code);

        for ($i = 0; $i < PhoneVerificationCode::MAX_ATTEMPTS; $i++) {
            $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $wrong])
                ->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'too_many_attempts');
    }

    public function test_an_expired_code_is_refused(): void
    {
        $code = $this->requestCode();

        $this->travel((int) config('twogende.otp.ttl_minutes') + 1)->minutes();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'expired');
    }

    public function test_a_code_cannot_be_used_twice(): void
    {
        $code = $this->requestCode();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])->assertOk();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'not_found');
    }

    public function test_requesting_a_new_code_invalidates_the_previous_one(): void
    {
        $first = $this->requestCode();

        $this->travel((int) config('twogende.otp.resend_cooldown_seconds') + 1)->seconds();
        $second = $this->requestCode();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $first])
            ->assertStatus(422);

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $second])
            ->assertOk();
    }

    public function test_codes_cannot_be_requested_faster_than_the_cooldown(): void
    {
        $this->requestCode();

        $this->postJson('/api/v1/auth/otp', ['phone' => '0701234567'])
            ->assertStatus(429)
            ->assertJsonStructure(['retry_after_seconds']);

        $this->sms->assertSentCount(1);
    }

    public function test_a_landline_is_refused(): void
    {
        $this->postJson('/api/v1/auth/otp', ['phone' => '0414234567'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        $this->sms->assertNothingSent();
    }

    public function test_a_suspended_account_cannot_sign_in(): void
    {
        User::factory()->create(['phone' => '+256701234567', 'status' => 'suspended']);
        $code = $this->requestCode();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->assertStatus(403)
            ->assertJsonMissingPath('token');
    }

    public function test_signing_out_revokes_only_the_token_that_was_used(): void
    {
        $code = $this->requestCode();
        $token = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '0701234567', 'code' => $code])
            ->json('token');

        $user = User::query()->sole();
        $other = $user->createToken('tablet')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        // The test app is reused across calls, so the guard still holds the
        // user it resolved. Production gets a fresh container per request.
        $this->app['auth']->forgetGuards();

        $this->assertSame(1, $user->tokens()->count());
        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/v1/me')->assertOk();
    }

    public function test_the_profile_endpoint_requires_a_token(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    private function wrongCode(string $actual): string
    {
        return str_pad(
            (string) ((((int) $actual) + 1) % (10 ** strlen($actual))),
            strlen($actual),
            '0',
            STR_PAD_LEFT
        );
    }
}
