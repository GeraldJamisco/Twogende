<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Where along the route a passenger wants picking up.
     *
     * "Twogende Ride Posted.dc.html" lists each request as "1 seat · Kireka
     * stage" — three passengers on one Kampala→Jinja trip joining at three
     * different points. The driver needs to know where to stop.
     *
     * Nullable: a passenger who doesn't say is assumed to be joining at the
     * trip's own origin, which is what the screen falls back to.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('pickup_place_id')->nullable()->after('seats');
            $table->string('pickup_name', 120)->nullable()->after('pickup_place_id');
            $table->decimal('pickup_lat', 10, 7)->nullable()->after('pickup_name');
            $table->decimal('pickup_lng', 10, 7)->nullable()->after('pickup_lat');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['pickup_place_id', 'pickup_name', 'pickup_lat', 'pickup_lng']);
        });
    }
};
