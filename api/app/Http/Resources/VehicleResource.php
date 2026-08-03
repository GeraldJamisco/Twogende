<?php

namespace App\Http\Resources;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The car, as shown on a trip.
 *
 * The number plate is deliberately absent. A passenger browsing search results
 * has no need for it, and publishing every driver's plate against their name
 * and travel schedule is a tracking surface we shouldn't open. It's released
 * with the driver's contact details once a booking is accepted, which is the
 * point at which it's actually useful finding the car.
 *
 * @mixin Vehicle
 */
class VehicleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'make' => $this->make,
            'model' => $this->model,
            'colour' => $this->colour,
            'year' => $this->year,
            'description' => $this->description(),
            'passenger_seats' => $this->passenger_seats,
            'photo_url' => $this->photo_path ? asset('storage/'.$this->photo_path) : null,
            'verified' => $this->isVerified(),
            'status' => $this->status->value,

            // Four characters, so a passenger can pick the right car out of a
            // queue. The full plate is never published — see the class note.
            'plate_last4' => $this->plate_last4,

            /*
             * How a passenger picks this car out of a queue: the brand and the
             * last four of the plate, and nothing more. The full plate is
             * never published — see the class note.
             */
            'identifier' => trim(implode(' · ', array_filter([
                $this->make,
                $this->plate_last4,
            ]))),
        ];
    }
}
