<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();

            // Restricted, not cascaded: a vehicle with trip history is soft
            // deleted rather than removed, so the trip record stays intact.
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();

            // Coordinates are nullable phase 1 search is by place name, and
            // a driver typing "Ntinda" shouldn't be blocked on geocoding.
            $table->string('origin_name', 120);
            $table->decimal('origin_lat', 10, 7)->nullable();
            $table->decimal('origin_lng', 10, 7)->nullable();
            $table->string('destination_name', 120);
            $table->decimal('destination_lat', 10, 7)->nullable();
            $table->decimal('destination_lng', 10, 7)->nullable();

            $table->dateTime('departure_at');

            // seats_available is the live count and the thing two concurrent
            // accepts race over. Unsigned so the database refuses to go
            // negative even if application locking is ever bypassed.
            $table->unsignedTinyInteger('seats_total');
            $table->unsignedTinyInteger('seats_available');

            // Whole Ugandan shillings (UGX has no subunit in practice).
            // "Contribution", never "fare": this is cost-sharing between
            // travellers, not commercial transport under PSV rules.
            $table->unsignedInteger('contribution_per_seat');
            $table->char('currency', 3)->default('UGX');

            $table->text('notes')->nullable();

            $table->string('status', 20)->default('scheduled');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Passenger search: live trips on a route, ordered by departure.
            $table->index(['status', 'departure_at']);
            $table->index(['origin_name', 'destination_name', 'departure_at'], 'trips_route_search_index');

            // Driver's own trip list.
            $table->index(['driver_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
