<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('make', 60);
            $table->string('model', 60);
            $table->string('colour', 30);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('plate_number', 20)->unique();

            // Seats offered to passengers, so excluding the driver.
            $table->unsignedTinyInteger('passenger_seats')->default(4);

            $table->string('photo_path')->nullable();
            $table->string('registration_document_path')->nullable();

            $table->string('status', 20)->default('pending');
            $table->timestamp('verified_at')->nullable();
            $table->string('rejection_reason')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
