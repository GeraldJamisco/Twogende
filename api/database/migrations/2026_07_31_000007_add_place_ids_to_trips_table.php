<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Places are chosen from Google Places Autocomplete rather than typed
     * free-hand, so every trip carries Google's stable identifier alongside
     * the name and coordinates.
     *
     * This is what makes search work: two people who both picked "Ntinda" from
     * the suggestion list produce the same place_id, where "Ntinda", "ntinda"
     * and "Ntinda, Kampala" as raw text would have been three routes.
     */
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->string('origin_place_id', 255)->nullable()->after('origin_name');
            $table->string('destination_place_id', 255)->nullable()->after('destination_name');

            // Exact-match leg of the search. The coordinate radius fallback
            // catches the near-misses ("Ntinda" vs "Ntinda Stage").
            $table->index(['origin_place_id', 'destination_place_id', 'departure_at'], 'trips_place_search_index');
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropIndex('trips_place_search_index');
            $table->dropColumn(['origin_place_id', 'destination_place_id']);
        });
    }
};
