<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expo push tokens. A table rather than a column on users: people replace
     * phones, and plenty share one account across a phone and a tablet.
     */
    public function up(): void
    {
        Schema::create('push_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
            $table->string('token')->unique();
            $table->string('platform', 10)->nullable(); // android | ios
            $table->string('device_name')->nullable();

            // Expo replies "DeviceNotRegistered" for dead tokens; that's the
            // signal to stop sending and prune the row.
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('failed_at')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'failed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_tokens');
    }
};
