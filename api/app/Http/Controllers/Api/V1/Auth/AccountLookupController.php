<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RequestOtpRequest;
use App\Models\User;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

/**
 * Checks whether a number already has an account, before a code is sent.
 *
 * Two reasons this exists rather than folding into the OTP request: a
 * recognised user gets "Welcome back, Grace" instead of an anonymous code
 * prompt, and an unrecognised number gets a chance to confirm it typed itself
 * correctly before anyone pays to send an SMS to a wrong number.
 *
 * SECURITY TRADE-OFF, made deliberately: this necessarily reveals whether a
 * given number is registered, which makes it an account-enumeration endpoint.
 * Two things limit the damage —
 *
 *   1. Only the *first* name is returned. Enough for "Welcome back, Grace",
 *      not enough to identify someone from their number alone.
 *   2. It's throttled hard per IP (see the 'lookup' limiter), so sweeping a
 *      range of numbers is slow.
 *
 * If enumeration ever matters more than the greeting, delete this endpoint and
 * move the name into the verify response, where it's only revealed to somebody
 * who has proven they control the number.
 */
class AccountLookupController extends Controller
{
    public function __invoke(RequestOtpRequest $request): JsonResponse
    {
        $phone = $request->string('phone')->toString();

        $user = User::query()->where('phone', $phone)->first();

        return response()->json([
            'phone' => $phone,
            'phone_display' => PhoneNumber::forDisplay($phone),
            'exists' => $user !== null,

            /*
             * One word, for "Welcome back, Grace".
             *
             * users.name is what the person chose to be called — a nickname as
             * often as not. Their legal name is a different thing entirely and
             * lives on identity_verifications.full_name_on_document, which is
             * only ever used for verification and never surfaces here.
             *
             * Reduced to a single word deliberately: a full name attached to a
             * phone number is identifying, a first name is a greeting.
             *
             * Null when the account exists but hasn't been named yet — the app
             * falls back to a plain "Welcome back".
             */
            'greeting_name' => $user?->name
                ? Str::of($user->name)->trim()->explode(' ')->first()
                : null,
        ]);
    }
}
