<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phone_verification_codes', function (Blueprint $table) {
            $table->id();

            // Not a foreign key: codes are issued during registration, before
            // any user row exists.
            $table->string('phone', 20);

            $table->string('code_hash');
            $table->string('purpose', 20)->default('registration'); // registration | login | phone_change
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            // Lookup for "the newest live code for this number".
            $table->index(['phone', 'purpose', 'consumed_at']);

            // Throttling reads: how many codes went to this number recently.
            $table->index(['phone', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_verification_codes');
    }
};
