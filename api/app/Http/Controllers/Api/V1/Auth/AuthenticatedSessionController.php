<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Signing out. Signing *in* lives in OtpController a verified code is the
 * only way a session begins.
 */
class AuthenticatedSessionController extends Controller
{
    /**
     * Revoke only the token that made this request, leaving the user's other
     * devices signed in.
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }
}
