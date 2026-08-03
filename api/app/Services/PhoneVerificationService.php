<?php

namespace App\Services;

use App\Enums\OtpChannel;
use App\Enums\OtpPurpose;
use App\Enums\OtpVerificationResult;
use App\Models\PhoneVerificationCode;
use App\Services\Messaging\ChannelRouter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class PhoneVerificationService
{
    public function __construct(private readonly ChannelRouter $router) {}

    /**
     * Generate a code, send it, and store only its hash.
     *
     * Any code already outstanding for this number and purpose is consumed
     * first, so requesting a new one invalidates the old otherwise every
     * resend would widen the window of guessable codes.
     *
     * @return PhoneVerificationCode|null Null when no channel could deliver.
     */
    public function issue(
        string $phone,
        OtpPurpose $purpose = OtpPurpose::Registration,
        ?string $ipAddress = null,
    ): ?PhoneVerificationCode {
        $this->invalidateOutstanding($phone, $purpose);

        $code = $this->generateCode();

        $channel = $this->router->send($phone, $this->composeMessage($code));

        if (! $channel) {
            // Nothing was delivered, so there is no code to check against
            // recording one would leave the user waiting for a message that
            // never comes.
            return null;
        }

        return PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'purpose' => $purpose->value,
            'channel' => $channel->value,
            'expires_at' => now()->addMinutes((int) config('twogende.otp.ttl_minutes')),
            'ip_address' => $ipAddress,
        ]);
    }

    /**
     * Check a code and burn it on success.
     *
     * A wrong guess costs an attempt; running out of attempts is terminal for
     * that code, so brute-forcing six digits means repeatedly requesting new
     * codes, which the resend cooldown and route throttle both slow down.
     */
    public function verify(string $phone, string $code, OtpPurpose $purpose = OtpPurpose::Registration): OtpVerificationResult
    {
        $record = $this->outstandingFor($phone, $purpose);

        if (! $record) {
            return OtpVerificationResult::NotFound;
        }

        if ($record->expires_at->isPast()) {
            return OtpVerificationResult::Expired;
        }

        if ($record->attempts >= PhoneVerificationCode::MAX_ATTEMPTS) {
            return OtpVerificationResult::TooManyAttempts;
        }

        if (! Hash::check($code, $record->code_hash)) {
            $record->increment('attempts');

            return $record->attempts >= PhoneVerificationCode::MAX_ATTEMPTS
                ? OtpVerificationResult::TooManyAttempts
                : OtpVerificationResult::Incorrect;
        }

        $record->forceFill(['consumed_at' => now()])->save();

        return OtpVerificationResult::Verified;
    }

    /**
     * When this number may next be sent a code, or null if it may be sent one
     * straight away.
     */
    public function nextIssueAllowedAt(string $phone, OtpPurpose $purpose = OtpPurpose::Registration): ?Carbon
    {
        $cooldown = (int) config('twogende.otp.resend_cooldown_seconds');

        $latest = PhoneVerificationCode::query()
            ->where('phone', $phone)
            ->where('purpose', $purpose->value)
            ->latest('created_at')
            ->first();

        if (! $latest) {
            return null;
        }

        $readyAt = $latest->created_at->addSeconds($cooldown);

        return $readyAt->isFuture() ? $readyAt : null;
    }

    /**
     * The live code for this number and purpose, if there is one.
     */
    private function outstandingFor(string $phone, OtpPurpose $purpose): ?PhoneVerificationCode
    {
        return PhoneVerificationCode::query()
            ->where('phone', $phone)
            ->where('purpose', $purpose->value)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();
    }

    private function invalidateOutstanding(string $phone, OtpPurpose $purpose): void
    {
        PhoneVerificationCode::query()
            ->where('phone', $phone)
            ->where('purpose', $purpose->value)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);
    }

    private function generateCode(): string
    {
        $length = (int) config('twogende.otp.length');

        // random_int, not rand(): this is a credential.
        return str_pad((string) random_int(0, (10 ** $length) - 1), $length, '0', STR_PAD_LEFT);
    }

    private function composeMessage(string $code): string
    {
        $minutes = (int) config('twogende.otp.ttl_minutes');

        return "{$code} is your Twogende verification code. It expires in {$minutes} minutes. Do not share it with anyone.";
    }

    /** Channels the router will attempt, in order. Exposed for the dev console. */
    public function channelOrder(): array
    {
        return array_map(
            fn (string $value) => OtpChannel::from($value),
            (array) config('twogende.otp.channels', ['sms'])
        );
    }
}
