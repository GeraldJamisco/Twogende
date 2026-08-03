<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Step 2 of "Twogende Driver Verification.dc.html".
 */
class StoreVehicleRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // One field, as the design has it — "Toyota Premio", not a make
            // and a model to be picked apart.
            'make_and_model' => ['required', 'string', 'min:2', 'max:60'],
            'colour' => ['required', 'string', 'min:2', 'max:30'],

            /*
             * Only the last four characters. The design's own trust note
             * promises passengers never see the plate number; four characters
             * is enough to pick the right car out of a queue and not enough to
             * look somebody up. The full plate is read from the photo during
             * review.
             */
            'plate_last4' => ['required', 'string', 'size:4', 'alpha_num'],

            'photo' => ['required', 'image', 'max:'.(int) config('twogende.uploads.max_image_kb')],

            /*
             * Not on the design, but a trip can't be published without it —
             * StoreTripRequest refuses to sell more seats than the car has.
             * Optional here, defaulting to four, so the screen doesn't have to
             * change; see the handover note.
             */
            'passenger_seats' => ['sometimes', 'integer', 'min:1', 'max:8'],
        ];
    }

    public function passengerSeats(): int
    {
        return $this->integer('passenger_seats', 4);
    }
}
