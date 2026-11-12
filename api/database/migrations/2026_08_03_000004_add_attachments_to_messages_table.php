<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Location and photo messages, so both sides can show each other exactly
     * where they are rather than describing it.
     *
     * `kind` already distinguished user from system; it now also carries
     * 'location' and 'image'. The body stays useful for all of them - a
     * location keeps its place name there, an image its caption - so anything
     * rendering a thread has something to show even if it doesn't understand
     * the kind.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->after('body');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');

            /*
             * Private disk. A photo of where somebody is standing is a photo
             * of where somebody is - it gets served through an authorised
             * route, never a public URL.
             */
            $table->string('image_path')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'image_path']);
        });
    }
};
