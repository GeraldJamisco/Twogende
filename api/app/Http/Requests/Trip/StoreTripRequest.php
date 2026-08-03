<?php

namespace App\Http\Requests\Trip;

use App\Enums\VerificationStatus;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTripRequest extends FormRequest
{
    /**
     * Checked before the rules below run, which is the point: someone who
     * isn't allowed to drive at all should be told that, not handed a
     * field-level complaint about their vehicle.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Trip::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'vehicle_id' => [
                'required',
                // Must be the driver's own vehicle, and approved. Scoping the
                // existence check to the user is what stops someone posting a
                // trip against a stranger's car.
                Rule::exists(Vehicle::class, 'id')
                    ->where('user_id', $this->user()->getKey())
                    ->where('status', VerificationStatus::Approved->value)
                    ->whereNull('deleted_at'),
            ],

            // Places come from the autocomplete proxy, never free text, so the
            // identifier and coordinates are all required together.
            'origin.place_id' => ['required', 'string', 'max:255'],
            'origin.name' => ['required', 'string', 'max:120'],
            'origin.latitude' => ['required', 'numeric', 'between:-90,90'],
            'origin.longitude' => ['required', 'numeric', 'between:-180,180'],

            'destination.place_id' => ['required', 'string', 'max:255', 'different:origin.place_id'],
            'destination.name' => ['required', 'string', 'max:120'],
            'destination.latitude' => ['required', 'numeric', 'between:-90,90'],
            'destination.longitude' => ['required', 'numeric', 'between:-180,180'],

            'departure_at' => [
                'required',
                'date',
                'after:now',
                'before:'.now()->addDays((int) config('twogende.trips.max_days_ahead'))->toDateTimeString(),
            ],

            'seats_total' => ['required', 'integer', 'min:1', 'max:8'],

            // Whole shillings. Zero is allowed some people genuinely offer a
            // free lift, and refusing that would push them off the platform.
            'contribution_per_seat' => ['required', 'integer', 'min:0', 'max:1000000'],

            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $vehicle = Vehicle::find($this->input('vehicle_id'));

                // A driver can't sell more seats than the car has.
                if ($vehicle && $this->integer('seats_total') > $vehicle->passenger_seats) {
                    $validator->errors()->add(
                        'seats_total',
                        "That vehicle seats {$vehicle->passenger_seats} passengers."
                    );
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'vehicle_id.exists' => 'Choose one of your verified vehicles.',
            'destination.place_id.different' => 'The destination must be somewhere other than the origin.',
            'departure_at.after' => 'A trip has to depart in the future.',
        ];
    }

    /**
     * Flatten the nested place objects into the columns the model expects.
     *
     * @return array<string, mixed>
     */
    public function toTripAttributes(): array
    {
        $validated = $this->validated();

        return [
            'vehicle_id' => $validated['vehicle_id'],
            'origin_place_id' => $validated['origin']['place_id'],
            'origin_name' => $validated['origin']['name'],
            'origin_lat' => $validated['origin']['latitude'],
            'origin_lng' => $validated['origin']['longitude'],
            'destination_place_id' => $validated['destination']['place_id'],
            'destination_name' => $validated['destination']['name'],
            'destination_lat' => $validated['destination']['latitude'],
            'destination_lng' => $validated['destination']['longitude'],
            'departure_at' => $validated['departure_at'],
            'seats_total' => $validated['seats_total'],
            'contribution_per_seat' => $validated['contribution_per_seat'],
            'notes' => $validated['notes'] ?? null,
        ];
    }
}
