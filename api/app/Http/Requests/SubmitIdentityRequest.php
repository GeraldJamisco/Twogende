<?php

namespace App\Http\Requests;

use App\Enums\IdentityDocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Step 1 of "Twogende Driver Verification.dc.html".
 */
class SubmitIdentityRequest extends FormRequest
{
    /**
     * The design's three choices map onto the document types the schema
     * already knows about.
     *
     * @var array<string, IdentityDocumentType>
     */
    private const ID_TYPES = [
        'license' => IdentityDocumentType::DrivingPermit,
        'national' => IdentityDocumentType::NationalId,
        'passport' => IdentityDocumentType::Passport,
    ];

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maxKb = (int) config('twogende.uploads.max_image_kb');

        return [
            'full_name' => ['required', 'string', 'min:2', 'max:255'],
            // Old enough to hold a Ugandan driving permit, and a sanity bound
            // at the other end.
            'date_of_birth' => ['required', 'date', 'before:'.now()->subYears(18)->toDateString(), 'after:'.now()->subYears(100)->toDateString()],
            'id_type' => ['required', Rule::in(array_keys(self::ID_TYPES))],
            'id_number' => ['required', 'string', 'min:4', 'max:60'],
            'id_photo' => ['required', 'image', 'max:'.$maxKb],
            'selfie' => ['required', 'image', 'max:'.$maxKb],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_of_birth.before' => 'You must be at least 18 to drive on Twogende.',
        ];
    }

    public function documentType(): IdentityDocumentType
    {
        return self::ID_TYPES[$this->string('id_type')->toString()];
    }
}
