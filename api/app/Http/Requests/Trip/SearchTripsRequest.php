<?php

namespace App\Http\Requests\Trip;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchTripsRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Both places are optional: with neither, this degrades into the
            // "leaving soon near you" feed the home screen shows.
            'origin_place_id' => ['sometimes', 'string', 'max:255'],
            'origin_latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'origin_longitude' => ['sometimes', 'numeric', 'between:-180,180'],

            'destination_place_id' => ['sometimes', 'string', 'max:255'],
            'destination_latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'destination_longitude' => ['sometimes', 'numeric', 'between:-180,180'],

            'date' => ['sometimes', 'date'],

            /*
             * "What time do you want to leave?" on the search screen. An ISO
             * datetime rather than a bare time, so the caller decides which day
             * it belongs to instead of this having to guess.
             */
            'after' => ['sometimes', 'date'],

            'seats' => ['sometimes', 'integer', 'min:1', 'max:8'],

            // Backs the filter chips on the search screen. "departure" is both
            // the default and what the results header claims.
            'sort' => ['sometimes', Rule::in(['departure', 'price'])],

            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function sort(): string
    {
        return $this->string('sort', 'departure')->toString();
    }

    public function seats(): int
    {
        return $this->integer('seats', 1);
    }

    public function perPage(): int
    {
        return $this->integer('per_page', 20);
    }
}
