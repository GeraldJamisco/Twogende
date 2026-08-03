<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
     * Google Places (New). Server-side only this key is never sent to the
     * app. Restrict it to the Places API and to this server's IP in the
     * Google Cloud console.
     */
    'google_places' => [
        'key' => env('GOOGLE_PLACES_KEY'),
        'autocomplete_url' => 'https://places.googleapis.com/v1/places:autocomplete',
        'details_url' => 'https://places.googleapis.com/v1/places',
        'nearby_url' => 'https://places.googleapis.com/v1/places:searchNearby',
    ],

];
