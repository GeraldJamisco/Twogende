<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The two switches on the settings screen, and why somebody left.
     *
     * Ride updates default on: they are the messages a booking is useless
     * without - accepted, cancelled, driver arriving. Marketing defaults off,
     * which is both the decent thing and what consent under the Data
     * Protection and Privacy Act, 2019 actually requires: opt-in, not opt-out.
     *
     * deletion_reason is kept on the soft-deleted row rather than in a
     * separate table. It is one nullable string, it is only ever read in
     * aggregate, and a join table for it would be three files answering a
     * question that fits in a column.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('notify_ride_updates')->default(true)->after('bio');
            $table->boolean('notify_marketing')->default(false)->after('notify_ride_updates');
            $table->string('deletion_reason')->nullable()->after('notify_marketing');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['notify_ride_updates', 'notify_marketing', 'deletion_reason']);
        });
    }
};
