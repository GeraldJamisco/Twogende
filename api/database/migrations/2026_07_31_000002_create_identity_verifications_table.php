<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identity_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('document_type', 30); // national_id | passport | driving_permit
            $table->string('document_number');
            $table->string('full_name_on_document');

            // Object-storage keys, never public URLs. These are ID documents.
            $table->string('front_image_path');
            $table->string('back_image_path')->nullable();
            $table->string('selfie_image_path')->nullable();

            $table->string('status', 20)->default('pending');
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rejection_reason')->nullable();
            $table->timestamps();

            // A rejected submission is kept and a new row added, so a user can
            // have several. users.identity_verified_at caches the outcome.
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identity_verifications');
    }
};
