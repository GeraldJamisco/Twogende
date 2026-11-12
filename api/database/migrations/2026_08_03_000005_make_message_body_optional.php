<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A photo or a dropped pin doesn't need words with it.
     *
     * `body` was required when every message was typed. Now it's the caption
     * on an image and the place name on a location, and both are optional - * the attachment is the message.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->text('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->text('body')->nullable(false)->change();
        });
    }
};
