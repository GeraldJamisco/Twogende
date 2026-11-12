<?php

use App\Http\Controllers\Api\V1\Auth\AccountLookupController;
use App\Http\Controllers\Api\V1\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Api\V1\Auth\OtpController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\IdentityVerificationController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PlaceController;
use App\Http\Controllers\Api\V1\PlatformConfigController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\RatingController;
use App\Http\Controllers\Api\V1\TripController;
use App\Http\Controllers\Api\V1\TripSummaryController;
use App\Http\Controllers\Api\V1\VehicleController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    Route::prefix('auth')->group(function () {
        /*
         * A phone number is the only credential, so these two routes are the
         * whole of sign-in and sign-up. Both are throttled by number as well as
         * by IP see AppServiceProvider because every code costs money to
         * send.
         */
        /*
         * Is this number known? Answered before a code is sent, so a returning
         * user can be greeted by name and a mistyped number can be corrected
         * before anyone pays to text it. See the controller for the
         * enumeration trade-off this carries.
         */
        Route::post('lookup', AccountLookupController::class)
            ->middleware('throttle:lookup')
            ->name('auth.lookup');

        Route::post('otp', [OtpController::class, 'request'])
            ->middleware('throttle:otp')
            ->name('auth.otp.request');

        Route::post('otp/verify', [OtpController::class, 'verify'])
            ->middleware('throttle:otp-verify')
            ->name('auth.otp.verify');

        Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
            ->middleware('auth:sanctum')
            ->name('auth.logout');
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [ProfileController::class, 'show'])->name('profile.show');
        // Where a newly created account gets its name.
        Route::patch('me', [ProfileController::class, 'update'])->name('profile.update');
        Route::get('users/{user}', [ProfileController::class, 'publicProfile'])->name('profile.public');

        // Values the Terms and the earnings screen must agree on.
        Route::get('config', PlatformConfigController::class)->name('config');
        Route::patch('me/notifications', [ProfileController::class, 'updateNotifications'])
            ->name('profile.notifications');
        Route::delete('me', [ProfileController::class, 'destroy'])->name('profile.destroy');

        // Driver verification, step 1.
        Route::get('me/identity', [IdentityVerificationController::class, 'show'])->name('identity.show');
        Route::post('me/identity', [IdentityVerificationController::class, 'store'])->name('identity.store');

        // Driver verification, step 2.
        Route::get('vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
        Route::post('vehicles', [VehicleController::class, 'store'])->name('vehicles.store');
        Route::delete('vehicles/{vehicle}', [VehicleController::class, 'destroy'])->name('vehicles.destroy');

        // Google Places proxy. Throttled because every call is billed.
        Route::middleware('throttle:places')->group(function () {
            Route::get('places/autocomplete', [PlaceController::class, 'autocomplete'])->name('places.autocomplete');
            // Declared before places/{placeId} so "nearest" isn't taken for an ID.
            Route::get('places/nearest', [PlaceController::class, 'nearest'])->name('places.nearest');
            Route::get('places/{placeId}', [PlaceController::class, 'show'])->name('places.show');
        });

        // Search and the home feed are the same endpoint; the feed just omits
        // the place filters.
        Route::get('trips', [TripController::class, 'index'])->name('trips.index');
        Route::get('trips/mine', [TripController::class, 'mine'])->name('trips.mine');
        // Before trips/{trip}, so "price-suggestion" isn't read as an ID.
        Route::get('trips/price-suggestion', [TripController::class, 'priceSuggestion'])
            ->name('trips.price-suggestion');
        Route::get('trips/cancellation-reasons', [TripController::class, 'cancellationReasons'])
            ->name('trips.cancellation-reasons');
        Route::post('trips', [TripController::class, 'store'])->name('trips.store');
        Route::get('trips/{trip}', [TripController::class, 'show'])->name('trips.show');
        Route::patch('trips/{trip}', [TripController::class, 'update'])->name('trips.update');
        Route::post('trips/{trip}/start', [TripController::class, 'start'])->name('trips.start');
        Route::post('trips/{trip}/complete', [TripController::class, 'complete'])->name('trips.complete');
        // The driver's end-of-trip screen: the split, and who still needs rating.
        Route::get('trips/{trip}/summary', TripSummaryController::class)->name('trips.summary');
        Route::post('trips/{trip}/cancel', [TripController::class, 'cancel'])->name('trips.cancel');

        // Bookings. Requesting is the passenger's; responding is the driver's.
        Route::get('trips/{trip}/bookings', [BookingController::class, 'forTrip'])->name('trips.bookings');
        Route::post('trips/{trip}/bookings', [BookingController::class, 'store'])->name('bookings.store');
        Route::get('bookings', [BookingController::class, 'index'])->name('bookings.index');
        // Before bookings/{booking}, so "active" isn't read as an id.
        Route::get('bookings/active', [BookingController::class, 'active'])->name('bookings.active');
        Route::get('bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');
        Route::post('bookings/{booking}/accept', [BookingController::class, 'accept'])->name('bookings.accept');
        Route::post('bookings/{booking}/reject', [BookingController::class, 'reject'])->name('bookings.reject');
        // Settling the contribution. Twogende holds none of this money.
        Route::get('bookings/{booking}/payment', [PaymentController::class, 'show'])->name('payments.show');
        Route::post('bookings/{booking}/payment', [PaymentController::class, 'store'])->name('payments.store');
        Route::get('payments/{payment}', [PaymentController::class, 'status'])->name('payments.status');

        // Rating the other side, once the ride is done.
        Route::get('bookings/{booking}/rating', [RatingController::class, 'pending'])->name('ratings.pending');
        Route::post('bookings/{booking}/rating', [RatingController::class, 'store'])->name('ratings.store');

        Route::post('bookings/{booking}/cancel', [BookingController::class, 'cancel'])->name('bookings.cancel');

        // Messaging. A booking is the conversation, so BookingPolicy already
        // decides who may read and write here.
        /*
         * Live position, write-only. Nothing reads anybody's coordinates back
         * out - the only visible effect is the arrival notice it can trigger.
         */
        Route::post('trips/{trip}/location', [LocationController::class, 'driver'])->name('location.driver');
        Route::post('bookings/{booking}/location', [LocationController::class, 'passenger'])->name('location.passenger');

        Route::get('conversations', [MessageController::class, 'conversations'])->name('conversations.index');
        Route::get('bookings/{booking}/messages', [MessageController::class, 'index'])->name('messages.index');
        Route::post('bookings/{booking}/messages', [MessageController::class, 'store'])->name('messages.store');
        // Chat photos are private; this is the only way to see one.
        Route::get('messages/{message}/image', [MessageController::class, 'image'])->name('messages.image');
    });
});
