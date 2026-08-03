<?php

namespace App\Http\Controllers\Dev;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\PhoneVerificationCode;
use App\Models\Rating;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Sms\DevSmsSender;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * A local-only window onto the API: fire real requests at real endpoints and
 * watch the database change underneath. Not part of the product surface see
 * EnsureLocalEnvironment and the conditional registration in bootstrap/app.php.
 */
class DevConsoleController extends Controller
{
    public function index(): View
    {
        return view('dev.console', [
            'otpLength' => (int) config('twogende.otp.length'),
            'smsDriver' => (string) config('twogende.sms.driver'),
        ]);
    }

    /**
     * Everything the state panel renders, in one round trip.
     */
    public function state(): JsonResponse
    {
        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'counts' => [
                'users' => User::withTrashed()->count(),
                'codes' => PhoneVerificationCode::count(),
                'vehicles' => Vehicle::withTrashed()->count(),
                'trips' => Trip::withTrashed()->count(),
                'bookings' => Booking::count(),
                'ratings' => Rating::count(),
                'tokens' => DB::table('personal_access_tokens')->count(),
            ],
            'tables' => [
                'users' => $this->users(),
                'codes' => $this->codes(),
                'vehicles' => $this->vehicles(),
                'trips' => $this->trips(),
                'bookings' => $this->bookings(),
                'ratings' => $this->ratings(),
                'tokens' => $this->tokens(),
            ],
        ]);
    }

    public function outbox(): JsonResponse
    {
        return response()->json(['messages' => DevSmsSender::outbox()]);
    }

    public function clearOutbox(): JsonResponse
    {
        DevSmsSender::clear();

        return response()->json(['message' => 'Outbox cleared.']);
    }

    /**
     * Wipe and rebuild the local database. Destructive on purpose, and the
     * console asks before calling it.
     */
    public function reset(): JsonResponse
    {
        Artisan::call('migrate:fresh', ['--force' => true]);
        DevSmsSender::clear();

        return response()->json(['message' => 'Database reset.']);
    }

    /**
     * Enough data to see the trip and booking screens do something before
     * those endpoints exist.
     */
    public function seed(): JsonResponse
    {
        $driver = User::factory()->identityVerified()->create(['name' => 'Okello Samuel']);
        $vehicle = Vehicle::factory()->verified()->for($driver, 'owner')->create();

        $trips = collect([
            ['Ntinda', 'Kampala CBD', 3000],
            ['Kireka', 'Kampala CBD', 4000],
            ['Nansana', 'Entebbe', 15000],
        ])->map(fn (array $route) => Trip::factory()->for($vehicle)->create([
            'driver_id' => $driver->id,
            'origin_name' => $route[0],
            'destination_name' => $route[1],
            'contribution_per_seat' => $route[2],
            'departure_at' => now()->addDay()->setTime(7, 30),
            'seats_total' => 3,
            'seats_available' => 3,
        ]));

        $passenger = User::factory()->create(['name' => 'Nabirye Sarah']);
        Booking::factory()->for($trips->first())->for($passenger, 'passenger')->create();

        return response()->json([
            'message' => 'Seeded 1 driver, 1 vehicle, 3 trips, 1 passenger, 1 pending booking.',
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function users(): array
    {
        return User::withTrashed()->latest('id')->limit(25)->get()->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
            'phone_verified' => $user->phone_verified_at !== null,
            'identity_verified' => $user->identity_verified_at !== null,
            'can_drive' => $user->canDrive(),
            'rating_driver' => $user->rating_as_driver,
            'rating_passenger' => $user->rating_as_passenger,
            'status' => $user->status,
            'deleted' => $user->trashed(),
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function codes(): array
    {
        return PhoneVerificationCode::latest('id')->limit(25)->get()->map(fn (PhoneVerificationCode $code) => [
            'id' => $code->id,
            'phone' => $code->phone,
            'purpose' => $code->purpose->value,
            // The hash, deliberately. Codes live in the outbox panel, not here.
            'code_hash' => substr($code->code_hash, 0, 18).'…',
            'attempts' => $code->attempts,
            'expires_at' => $code->expires_at->toIso8601String(),
            'consumed' => $code->consumed_at !== null,
            'usable' => $code->isUsable(),
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function vehicles(): array
    {
        return Vehicle::withTrashed()->with('owner')->latest('id')->limit(25)->get()->map(fn (Vehicle $vehicle) => [
            'id' => $vehicle->id,
            'owner' => $vehicle->owner?->name,
            'description' => $vehicle->description(),
            'plate_number' => $vehicle->plate_number,
            'passenger_seats' => $vehicle->passenger_seats,
            'status' => $vehicle->status->value,
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function trips(): array
    {
        return Trip::withTrashed()->with('driver')->latest('id')->limit(25)->get()->map(fn (Trip $trip) => [
            'id' => $trip->id,
            'driver' => $trip->driver?->name,
            'route' => $trip->origin_name.' → '.$trip->destination_name,
            'departure_at' => $trip->departure_at->toIso8601String(),
            'seats' => $trip->seats_available.' / '.$trip->seats_total,
            'contribution_per_seat' => $trip->contribution_per_seat,
            'currency' => $trip->currency,
            'status' => $trip->status->value,
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function bookings(): array
    {
        return Booking::with(['passenger', 'trip'])->latest('id')->limit(25)->get()->map(fn (Booking $booking) => [
            'id' => $booking->id,
            'trip_id' => $booking->trip_id,
            'passenger' => $booking->passenger?->name,
            'seats' => $booking->seats,
            'total_contribution' => $booking->total_contribution,
            'status' => $booking->status->value,
            'contact_unlocked' => $booking->allowsContactExchange(),
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function ratings(): array
    {
        return Rating::with(['rater', 'ratee'])->latest('id')->limit(25)->get()->map(fn (Rating $rating) => [
            'id' => $rating->id,
            'booking_id' => $rating->booking_id,
            'rater' => $rating->rater?->name,
            'ratee' => $rating->ratee?->name,
            'ratee_role' => $rating->ratee_role->value,
            'stars' => $rating->stars,
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function tokens(): array
    {
        return DB::table('personal_access_tokens')
            ->join('users', 'users.id', '=', 'personal_access_tokens.tokenable_id')
            ->select('personal_access_tokens.id', 'personal_access_tokens.name', 'users.name as user', 'personal_access_tokens.last_used_at')
            ->latest('personal_access_tokens.id')
            ->limit(25)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }
}
