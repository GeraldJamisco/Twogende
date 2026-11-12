<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Platform commission
    |--------------------------------------------------------------------------
    |
    | The share Twogende keeps out of each completed seat. The rest is the
    | driver's, who is recovering the cost of a journey they were making
    | anyway this is a service fee on the introduction, not a cut of a fare.
    |
    | Nothing settles yet: no money moves through Twogende until the wallet
    | lands, so this only decides what the trip summary shows. Rounding is
    | per seat and to the whole shilling, and the driver is credited the
    | remainder, so fee + payout always equals what the passenger contributed.
    |
    */

    'platform' => [
        'commission_rate' => (float) env('PLATFORM_COMMISSION_RATE', 0.20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Where people write to us
    |--------------------------------------------------------------------------
    |
    | Quoted in the privacy policy and the terms, so they live here rather
    | than being typed into the copy on each screen.
    |
    */

    'support' => [
        'email' => env('SUPPORT_EMAIL', 'support@twogende.ug'),
        'privacy_email' => env('PRIVACY_EMAIL', 'privacy@twogende.ug'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Ratings
    |--------------------------------------------------------------------------
    |
    | Ratings are double-blind: what the other person said about you stays
    | sealed until you have said your piece. It gives people a reason to
    | finish the screen, and it stops a rating being written in reply to one
    | - nobody can retaliate against a score they haven't read.
    |
    | The seal can't hold forever, or a rating left by somebody who never
    | opens the app again would never be seen. After this many days it opens
    | regardless.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Payments
    |--------------------------------------------------------------------------
    |
    | Cash is the only method that works. It always will work - it needs
    | nothing but two people at a destination - and it is what nearly every
    | ride in Kampala will settle with anyway.
    |
    | Mobile money needs an aggregator in front of MTN and Airtel. Until one is
    | named here the gateway reports itself unavailable, the payment screen
    | offers cash alone, and no row is ever written claiming money moved.
    |
    */

    'payments' => [
        'gateway' => env('PAYMENTS_GATEWAY', 'none'),
    ],

    'ratings' => [
        'reveal_after_days' => (int) env('RATING_REVEAL_AFTER_DAYS', 14),
    ],

    /*
    |--------------------------------------------------------------------------
    | One-time passwords
    |--------------------------------------------------------------------------
    |
    | Codes are stored hashed, so these values govern the plaintext code that
    | briefly exists in memory on its way to the SMS gateway.
    |
    */

    'otp' => [
        'length' => 6,
        'ttl_minutes' => (int) env('OTP_TTL_MINUTES', 10),

        // Wrong guesses allowed before the code is burned and a new one is
        // required. Mirrored on PhoneVerificationCode::MAX_ATTEMPTS.
        'max_attempts' => 5,

        // Minimum gap between two codes going to the same number. Guards the
        // SMS bill as much as the account.
        'resend_cooldown_seconds' => (int) env('OTP_RESEND_COOLDOWN', 60),

        /*
         * Delivery channels, tried in order. WhatsApp first because it costs a
         * fraction of an SMS and is near-universal in Uganda; SMS last because
         * it's the one that always arrives.
         *
         * A channel with no credentials configured reports itself unavailable
         * and is skipped, so this reads as plain SMS until WhatsApp is set up.
         */
        'channels' => array_values(array_filter(
            explode(',', (string) env('OTP_CHANNELS', 'whatsapp,sms'))
        )),
    ],

    /*
    |--------------------------------------------------------------------------
    | SMS delivery
    |--------------------------------------------------------------------------
    |
    | 'log' writes the message to the application log instead of sending it,
    | which is what local development runs on. A real gateway (Africa's
    | Talking, Twilio) slots in as another driver without touching callers.
    |
    */

    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'sender_id' => env('SMS_SENDER_ID', 'Twogende'),

        /*
         * Africa's Talking. Set SMS_DRIVER=africastalking to use it.
         *
         * The sender ID is deliberately empty by default. An alphanumeric
         * sender ID ("Twogende") has to be registered and approved with
         * Africa's Talking before it can be used, and sending an unapproved
         * one is rejected outright rather than falling back to the shared
         * short code. Leave it blank until the registration comes through.
         *
         * The sandbox is a different host and takes the literal username
         * "sandbox". Nothing sent to it reaches a handset, so it is what
         * staging should point at.
         */
        'africastalking' => [
            'username' => env('AT_USERNAME'),
            'api_key' => env('AT_API_KEY'),
            'sender_id' => env('AT_SENDER_ID'),
            'sandbox' => (bool) env('AT_SANDBOX', false),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Phone numbers
    |--------------------------------------------------------------------------
    |
    | Phase 1 is Uganda only. Numbers are stored E.164 so that 0701234567 and
    | +256701234567 can't both claim to be new accounts.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Places
    |--------------------------------------------------------------------------
    |
    | Origins and destinations are chosen from Google Places Autocomplete, not
    | typed free-hand, and the request is proxied through this API so the key
    | never ships inside an APK.
    |
    */

    'places' => [
        'provider' => env('PLACES_PROVIDER', 'google'),

        // Phase 1 is Uganda only; this keeps suggestions from wandering.
        'region' => 'ug',

        // Suggestions are biased toward Kampala, where the commuter wedge is.
        'bias' => [
            'latitude' => 0.3476,
            'longitude' => 32.5825,
            'radius_metres' => 50000,
        ],

        // Place details barely change, and Google bills per lookup.
        'cache_ttl_minutes' => (int) env('PLACES_CACHE_TTL', 60 * 24 * 7),

        /*
         * Two places within this distance count as the same stop when matching
         * a search against a trip. Exact place_id equality is the first leg of
         * the search; this catches "Ntinda" against "Ntinda Stage", which are
         * different Google places a couple of hundred metres apart.
         */
        'match_radius_km' => (float) env('PLACES_MATCH_RADIUS_KM', 3.0),

        /*
         * How far to look when turning a GPS fix into a named place for
         * "My current location". Wide enough to find a stage or landmark from
         * a doorway, tight enough that the answer is still where you are.
         */
        'nearest_radius_metres' => (float) env('PLACES_NEAREST_RADIUS_M', 400),
    ],

    /*
    |--------------------------------------------------------------------------
    | Push notifications
    |--------------------------------------------------------------------------
    |
    | Expo's push service. Free, and the app is already Expo no FCM
    | credentials to manage in phase 1.
    |
    */

    'push' => [
        'enabled' => (bool) env('PUSH_ENABLED', true),
        'endpoint' => env('EXPO_PUSH_ENDPOINT', 'https://exp.host/--/api/v2/push/send'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Trips
    |--------------------------------------------------------------------------
    */

    'trips' => [
        /*
         * Drivers mark their own trips complete, but they forget, and an
         * uncompleted trip means nobody can leave a rating. A scheduled sweep
         * completes anything still running this long after departure.
         */
        'auto_complete_after_hours' => (int) env('TRIP_AUTO_COMPLETE_HOURS', 12),

        // How far ahead a trip may be posted.
        'max_days_ahead' => 90,

        /*
         * How close a driver has to get before the passenger is told they've
         * arrived. Generous enough for GPS drift in town, tight enough that
         * "here" means the same street rather than the same neighbourhood.
         */
        'arrival_radius_metres' => (float) env('ARRIVAL_RADIUS_M', 150),

        /*
         * Assumed town speed, used only for the rough "6 min away" on the
         * tracking screen. A real estimate needs the Directions API; this is a
         * straight line and is labelled as approximate.
         */
        'average_speed_kmh' => (float) env('AVERAGE_SPEED_KMH', 25),

        /*
         * A reported position is only trusted this long. Past it, a passenger's
         * stated pickup point is the better guess than a stale GPS fix.
         */
        'location_freshness_minutes' => (int) env('LOCATION_FRESHNESS_MINUTES', 10),

        /*
         * Trips needed on a route before a price suggestion is offered. Below
         * this the "range" is one person's opinion, so the screen shows nothing
         * rather than anchor a driver to it.
         */
        'price_suggestion_minimum' => (int) env('PRICE_SUGGESTION_MINIMUM', 4),

        /*
         * How long after its departure time a trip stays in search results.
         *
         * The search design shows an "On the way" state, so a trip that has
         * just set off but still has a free seat has to remain findable - * someone standing at the stage can still catch it. Past this window it
         * drops out, because the car is genuinely gone.
         */
        'departure_grace_minutes' => (int) env('TRIP_DEPARTURE_GRACE_MINUTES', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Chat
    |--------------------------------------------------------------------------
    |
    | The chat screen tells people "this chat remains open for this ride until
    | <date>". That has to be true, so the window is enforced server-side
    | rather than being copy on a screen.
    |
    | Measured from departure, which is the moment the ride is actually about.
    |
    */

    'chat' => [
        'open_hours' => (int) env('CHAT_OPEN_HOURS', 24),
    ],

    /*
    |--------------------------------------------------------------------------
    | Uploads
    |--------------------------------------------------------------------------
    |
    | Identity documents and selfies go to a PRIVATE disk. They are proof of
    | who somebody is, and a public URL for them would be a data breach waiting
    | to happen - no guessing, no hotlinking, no accidental indexing.
    |
    | Vehicle photos go to the public disk: they appear on trip cards, and a
    | photo of a car outside is not sensitive.
    |
    */

    'uploads' => [
        'identity_disk' => env('IDENTITY_DISK', 'local'),
        'vehicle_disk' => env('VEHICLE_DISK', 'public'),
        'max_image_kb' => 8192,
    ],

    'phone' => [
        'country_code' => '256',

        // All Ugandan mobile ranges are 07x nationally, i.e. 7x once the
        // trunk zero is stripped.
        'mobile_prefix' => '7',

        'national_digits' => 9,
    ],

];
