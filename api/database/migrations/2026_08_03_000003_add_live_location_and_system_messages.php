<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Live location, so "your driver is here" can be a real event.
     *
     * PRIVACY, deliberately: only the *latest* point is kept, per trip and per
     * booking — there is no location history table and no trail to subpoena or
     * leak. Raw coordinates never reach the other party either; all anyone
     * sees is the message that gets generated when the two are close enough.
     * Clearing the columns when a trip ends is the whole of "stop tracking".
     */
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->decimal('driver_lat', 10, 7)->nullable()->after('destination_lng');
            $table->decimal('driver_lng', 10, 7)->nullable()->after('driver_lat');
            // Stale positions are ignored rather than trusted.
            $table->timestamp('driver_located_at')->nullable()->after('driver_lng');
        });

        Schema::table('bookings', function (Blueprint $table) {
            // Optional: a passenger who shares their position gets a more
            // accurate arrival than one measured against the pickup point.
            $table->decimal('passenger_lat', 10, 7)->nullable()->after('pickup_lng');
            $table->decimal('passenger_lng', 10, 7)->nullable()->after('passenger_lat');
            $table->timestamp('passenger_located_at')->nullable()->after('passenger_lng');

            // Set once, so the arrival is announced once.
            $table->timestamp('driver_arrived_at')->nullable()->after('passenger_located_at');
        });

        Schema::table('messages', function (Blueprint $table) {
            // 'system' messages are written by Twogende, not by either party,
            // and render as the notice card rather than a bubble.
            $table->string('kind', 20)->default('user')->after('booking_id');
        });

        Schema::table('messages', function (Blueprint $table) {
            // A system message has no sender.
            $table->foreignId('sender_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['driver_lat', 'driver_lng', 'driver_located_at']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'passenger_lat', 'passenger_lng', 'passenger_located_at', 'driver_arrived_at',
            ]);
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
