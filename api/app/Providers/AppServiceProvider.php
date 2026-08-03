<?php

namespace App\Providers;

use App\Contracts\PlacesProvider;
use App\Contracts\SmsSender;
use App\Services\Messaging\ChannelRouter;
use App\Services\Messaging\SmsChannel;
use App\Services\Places\GooglePlacesProvider;
use App\Services\Sms\DevSmsSender;
use App\Services\Sms\LogSmsSender;
use App\Support\PhoneNumber;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PlacesProvider::class, function () {
            return match (config('twogende.places.provider')) {
                default => new GooglePlacesProvider,
            };
        });

        // Only SMS is wired up today. A WhatsAppChannel added to this list is
        // all that's needed to switch the routing on ChannelRouter already
        // prefers it and falls back here.
        $this->app->bind(ChannelRouter::class, function ($app) {
            return new ChannelRouter([
                $app->make(SmsChannel::class),
            ]);
        });

        $this->app->bind(SmsSender::class, function () {
            return match (config('twogende.sms.driver')) {
                // Logs *and* keeps an outbox the dev console can read.
                'dev' => new DevSmsSender,
                // Real gateways register here as they're added.
                default => new LogSmsSender,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Throttles for the endpoints that cost money or guard credentials.
     *
     * The SMS limits are keyed on the phone number *and* the IP: keying on IP
     * alone lets one attacker rotate addresses to bombard a single number, and
     * keying on the number alone lets one address walk through many numbers.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('otp', function (Request $request) {
            $phone = PhoneNumber::normalise($request->input('phone')) ?? 'unknown';

            return [
                Limit::perHour(5)->by('otp-phone:'.$phone),
                Limit::perHour(20)->by('otp-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('otp-verify', function (Request $request) {
            $phone = PhoneNumber::normalise($request->input('phone')) ?? 'unknown';

            // Generous enough for someone mistyping a code, tight enough that
            // six digits can't be walked through before the code expires.
            return [
                Limit::perMinute(10)->by('verify-phone:'.$phone),
                Limit::perMinute(30)->by('verify-ip:'.$request->ip()),
            ];
        });

        /*
         * Account lookup reveals whether a number is registered, so it's the
         * one endpoint an attacker would sweep a number range with. Tighter
         * than the OTP limits because, unlike those, it costs us nothing to
         * serve and so has no natural brake.
         */
        RateLimiter::for('lookup', function (Request $request) {
            return [
                Limit::perMinute(8)->by('lookup-ip:'.$request->ip()),
                Limit::perHour(40)->by('lookup-ip-hour:'.$request->ip()),
            ];
        });

        // Every places call is a billed Google request.
        RateLimiter::for('places', function (Request $request) {
            return Limit::perMinute(60)->by('places:'.($request->user()?->id ?? $request->ip()));
        });

        RateLimiter::for('login', function (Request $request) {
            $phone = PhoneNumber::normalise($request->input('phone')) ?? 'unknown';

            return [
                Limit::perMinute(5)->by('login-phone:'.$phone),
                Limit::perMinute(30)->by('login-ip:'.$request->ip()),
            ];
        });
    }
}
