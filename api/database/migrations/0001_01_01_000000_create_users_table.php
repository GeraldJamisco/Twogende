<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');

            // Phone is the identity on this product, not email. Stored E.164
            // (+256701234567) so the same number can't register twice under
            // local and international formatting.
            $table->string('phone', 20)->unique();
            $table->timestamp('phone_verified_at')->nullable();

            $table->string('email')->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            $table->string('photo_path')->nullable();
            $table->text('bio')->nullable();

            // Trust layer. Denormalised onto the user so rendering a profile
            // or a search result never has to aggregate the ratings table.
            $table->timestamp('identity_verified_at')->nullable();
            $table->unsignedInteger('trips_as_driver')->default(0);
            $table->unsignedInteger('trips_as_passenger')->default(0);
            $table->decimal('rating_as_driver', 3, 2)->nullable();
            $table->unsignedInteger('ratings_as_driver_count')->default(0);
            $table->decimal('rating_as_passenger', 3, 2)->nullable();
            $table->unsignedInteger('ratings_as_passenger_count')->default(0);

            $table->string('status', 20)->default('active'); // active | suspended
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
