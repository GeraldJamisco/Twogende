<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ratings', function (Blueprint $table) {
            $table->id();

            // The booking is the proof the two people actually travelled
            // together ratings can't exist outside a completed one.
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rater_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ratee_id')->constrained('users')->cascadeOnDelete();

            $table->string('ratee_role', 20); // driver | passenger
            $table->unsignedTinyInteger('stars'); // 1-5, enforced in the model
            $table->text('comment')->nullable();

            $table->timestamps();

            // One rating per person per booking, in either direction.
            $table->unique(['booking_id', 'rater_id']);

            // Profile reads: this user's score in a given role.
            $table->index(['ratee_id', 'ratee_role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ratings');
    }
};
