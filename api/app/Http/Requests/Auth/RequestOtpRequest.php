<?php

namespace App\Http\Requests\Auth;

use App\Rules\UgandanPhoneNumber;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

class RequestOtpRequest extends FormRequest
{
    /**
     * Normalise before validating so the code, the lookup and any later
     * account all key off the same E.164 string.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => PhoneNumber::normalise($this->input('phone')) ?? $this->input('phone')]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', new UgandanPhoneNumber],
        ];
    }
}
