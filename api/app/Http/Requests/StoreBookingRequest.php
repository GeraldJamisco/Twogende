<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'seats' => ['sometimes', 'integer', 'min:1', 'max:8'],

            // Optional: a passenger who doesn't name a pickup point is taken
            // to be joining at the trip's own origin.
            'pickup' => ['sometimes', 'array'],
            'pickup.place_id' => ['required_with:pickup', 'string', 'max:255'],
            'pickup.name' => ['required_with:pickup', 'string', 'max:120'],
            'pickup.latitude' => ['required_with:pickup', 'numeric', 'between:-90,90'],
            'pickup.longitude' => ['required_with:pickup', 'numeric', 'between:-180,180'],

            'message' => ['nullable', 'string', 'max:500'],
        ];
    }
}
