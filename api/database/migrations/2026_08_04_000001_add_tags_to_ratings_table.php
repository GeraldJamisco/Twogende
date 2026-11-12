<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The quick tags offered under the stars - "Smooth driving", "Late pickup".
     *
     * Stored as JSON rather than a related table: they're a fixed, small
     * vocabulary chosen per star rating, they're never queried individually,
     * and a join table would be three files to answer a question nobody asks.
     */
    public function up(): void
    {
        Schema::table('ratings', function (Blueprint $table) {
            $table->json('tags')->nullable()->after('stars');
        });
    }

    public function down(): void
    {
        Schema::table('ratings', function (Blueprint $table) {
            $table->dropColumn('tags');
        });
    }
};
