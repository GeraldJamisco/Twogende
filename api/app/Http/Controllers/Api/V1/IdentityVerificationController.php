<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\VerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitIdentityRequest;
use App\Http\Resources\IdentityVerificationResource;
use App\Models\IdentityVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IdentityVerificationController extends Controller
{
    /** The submission this user is waiting on, or their last rejection. */
    public function show(Request $request): JsonResponse
    {
        $latest = $request->user()->identityVerifications()->latest('id')->first();

        return response()->json([
            'data' => $latest ? new IdentityVerificationResource($latest) : null,
            'identity_verified' => $request->user()->hasVerifiedIdentity(),
        ]);
    }

    /**
     * Submit identity documents for review.
     *
     * Files go to a private disk. These are ID documents and a face — a public
     * URL for them would be a breach waiting to be found, so nothing here is
     * ever web-addressable and the paths never leave the server.
     */
    public function store(SubmitIdentityRequest $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedIdentity()) {
            return response()->json([
                'message' => 'Your identity is already verified.',
            ], 409);
        }

        if ($user->identityVerifications()->where('status', VerificationStatus::Pending)->exists()) {
            return response()->json([
                'message' => 'You already have a submission under review.',
            ], 409);
        }

        $disk = (string) config('twogende.uploads.identity_disk');
        $folder = 'identity/'.$user->getKey();

        $verification = new IdentityVerification;
        $verification->forceFill([
            'user_id' => $user->getKey(),
            'document_type' => $request->documentType()->value,
            'document_number' => $request->string('id_number')->toString(),
            'full_name_on_document' => $request->string('full_name')->toString(),
            'date_of_birth' => $request->date('date_of_birth'),
            'front_image_path' => $request->file('id_photo')->store($folder, $disk),
            'selfie_image_path' => $request->file('selfie')->store($folder, $disk),
            'status' => VerificationStatus::Pending->value,
        ])->save();

        return (new IdentityVerificationResource($verification))
            ->response()
            ->setStatusCode(201);
    }
}
