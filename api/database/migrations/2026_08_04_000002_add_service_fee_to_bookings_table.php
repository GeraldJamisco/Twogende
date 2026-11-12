<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What Twogende keeps out of each completed seat.
     *
     * Snapshotted onto the booking for the same reason contribution_per_seat
     * is: the rate in config can change, and a driver looking back at a trip
     * from three months ago must see the split they were actually shown, not
     * the one today's config would produce.
     *
     * Null until the ride completes - an unfinished ride has no split yet.
     * Money is whole shillings throughout; UGX has no subunit in practice.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedInteger('service_fee')->nullable()->after('total_contribution');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('service_fee');
        });
    }
};
