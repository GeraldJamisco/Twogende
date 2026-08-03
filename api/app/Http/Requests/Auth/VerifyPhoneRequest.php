<?php

namespace App\Http\Requests\Auth;

use App\Rules\UgandanPhoneNumber;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

class VerifyPhoneRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => PhoneNumber::normalise($this->input('phone')) ?? $this->input('phone')]);
        }

        // Users paste codes with stray spaces out of the SMS.
        if ($this->has('code')) {
            $this->merge(['code' => preg_replace('/\s+/', '', (string) $this->input('code'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', new UgandanPhoneNumber],
            'code' => ['required', 'string', 'digits:'.config('twogende.otp.length')],
            'device_name' => ['sometimes', 'string', 'max:255'],
        ];
    }

    public function deviceName(): string
    {
        return $this->input('device_name', 'mobile');
    }
}
