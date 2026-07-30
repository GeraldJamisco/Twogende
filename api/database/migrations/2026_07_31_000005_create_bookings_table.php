<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('passenger_id')->constrained('users')->cascadeOnDelete();

            $table->unsignedTinyInteger('seats')->default(1);

            // Snapshot at request time. The driver can edit the trip's
            // contribution afterwards; what the passenger agreed to must not
            // move under them.
            $table->unsignedInteger('contribution_per_seat');
            $table->unsignedInteger('total_contribution');
            $table->char('currency', 3)->default('UGX');

            $table->string('status', 30)->default('pending');
            $table->text('message')->nullable(); // passenger's note to the driver

            $table->timestamp('responded_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();

            // One booking row per passenger per trip for the life of the trip.
            // Re-requesting after a cancellation revives this row rather than
            // inserting a second one, which keeps the seat maths unambiguous.
            $table->unique(['trip_id', 'passenger_id']);

            $table->index(['passenger_id', 'status']);
            $table->index(['trip_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
