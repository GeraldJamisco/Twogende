<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Messages between a passenger and the driver of the trip they booked.
     *
     * The booking *is* the conversation. There's no separate threads table
     * because there's no other kind of conversation on Twogende: two people
     * can only message each other because one of them asked for a seat on the
     * other's trip, and that relationship already carries who may read it.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();

            $table->text('body');

            // Null until the other party has seen it - drives the unread count
            // on the Chats tab.
            $table->timestamp('read_at')->nullable();

            $table->timestamps();

            // Reading a thread newest-last, and counting what's unread.
            $table->index(['booking_id', 'created_at']);
            $table->index(['booking_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
