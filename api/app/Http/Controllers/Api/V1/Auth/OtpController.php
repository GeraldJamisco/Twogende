<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\OtpPurpose;
use App\Enums\OtpVerificationResult;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RequestOtpRequest;
use App\Http\Requests\Auth\VerifyPhoneRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\PhoneVerificationService;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;

/**
 * The whole of authentication.
 *
 * There is no password: a phone number is the only credential, and proving you
 * control it is both signing in and signing up. Whether the number is already
 * known is deliberately not revealed until after the code is verified before
 * that, this endpoint would otherwise be a way to test which numbers have
 * Twogende accounts.
 */
class OtpController extends Controller
{
    public function __construct(private readonly PhoneVerificationService $verification) {}

    /**
     * Send a code. Also the resend endpoint the cooldown is what separates a
     * legitimate second attempt from hammering.
     */
    public function request(RequestOtpRequest $request): JsonResponse
    {
        $phone = $request->string('phone')->toString();

        if ($readyAt = $this->verification->nextIssueAllowedAt($phone)) {
            return response()->json([
                'message' => 'Please wait before requesting another code.',
                'retry_after_seconds' => (int) now()->diffInSeconds($readyAt, absolute: true),
            ], 429);
        }

        $record = $this->verification->issue($phone, OtpPurpose::Registration, $request->ip());

        if (! $record) {
            return response()->json([
                'message' => 'We could not send a code to that number right now. Please try again shortly.',
            ], 502);
        }

        return response()->json([
            'message' => 'We sent a code to '.PhoneNumber::forDisplay($phone).'.',
            'phone' => $phone,
            'channel' => $record->channel->value,
            'expires_in_minutes' => (int) config('twogende.otp.ttl_minutes'),
            'resend_after_seconds' => (int) config('twogende.otp.resend_cooldown_seconds'),
        ]);
    }

    /**
     * Check the code and hand over the API token.
     *
     * A number nobody has used before becomes an account here there is no
     * separate registration step to complete. `profile_complete` tells the app
     * whether it still needs to ask for a name.
     */
    public function verify(VerifyPhoneRequest $request): JsonResponse
    {
        $phone = $request->string('phone')->toString();

        $result = $this->verification->verify(
            $phone,
            $request->string('code')->toString(),
            OtpPurpose::Registration,
        );

        if ($result !== OtpVerificationResult::Verified) {
            return response()->json([
                'message' => $result->message(),
                'reason' => $result->value,
            ], 422);
        }

        $user = User::query()->where('phone', $phone)->first();
        $isNew = $user === null;

        if ($isNew) {
            $user = new User;
            $user->forceFill([
                'phone' => $phone,
                'phone_verified_at' => now(),
                'status' => 'active',
            ])->save();
        } elseif (! $user->hasVerifiedPhone()) {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'This account has been suspended. Please contact Twogende support.',
            ], 403);
        }

        return response()->json([
            'message' => $isNew ? 'Welcome to Twogende.' : 'Signed in.',
            'is_new' => $isNew,
            'token' => $user->createToken($request->deviceName())->plainTextToken,
            'user' => new UserResource($user->refresh()),
        ]);
    }
}
