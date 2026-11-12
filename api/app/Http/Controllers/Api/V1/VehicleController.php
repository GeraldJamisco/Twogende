<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\VerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class VehicleController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return VehicleResource::collection(
            $request->user()->vehicles()->latest('id')->get()
        );
    }

    /**
     * Step 2 of driver verification: add the car.
     *
     * The car photo goes to the public disk - it appears on trip cards, and a
     * picture of a car outside isn't sensitive. The plate is a different
     * matter: only the last four characters are stored from the driver, and
     * the full plate is read off this photo during review.
     */
    public function store(StoreVehicleRequest $request): JsonResponse
    {
        $vehicle = new Vehicle;
        $vehicle->forceFill([
            'user_id' => $request->user()->getKey(),
            // The design collects make and model as one field; splitting
            // "Land Rover Discovery" on a space would mangle it.
            'make' => $request->string('make_and_model')->trim()->toString(),
            'model' => null,
            'colour' => $request->string('colour')->trim()->toString(),
            'plate_last4' => Str::upper($request->string('plate_last4')->toString()),
            'passenger_seats' => $request->passengerSeats(),
            'photo_path' => $request->file('photo')->store(
                'vehicles/'.$request->user()->getKey(),
                (string) config('twogende.uploads.vehicle_disk')
            ),
            'status' => VerificationStatus::Pending->value,
        ])->save();

        return (new VehicleResource($vehicle))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Vehicle $vehicle): JsonResponse
    {
        abort_unless($vehicle->user_id === $request->user()->getKey(), 403);

        // Soft delete: trips reference this row, and their history has to
        // survive the car being taken off the account.
        $vehicle->delete();

        return response()->json(['message' => 'Vehicle removed.']);
    }
}
