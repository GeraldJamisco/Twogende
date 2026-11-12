<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When the driver actually set off.
     *
     * departure_at is the time they *published*, and on Kampala roads the two
     * are rarely the same. The end-of-trip screen shows how long the journey
     * took, and subtracting a completion from a promise would report a
     * duration that includes however long everyone stood waiting.
     *
     * Null on trips a driver never pressed start on. The summary shows no
     * duration at all in that case rather than inventing one.
     */
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->timestamp('started_at')->nullable()->after('departure_at');
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn('started_at');
        });
    }
};
