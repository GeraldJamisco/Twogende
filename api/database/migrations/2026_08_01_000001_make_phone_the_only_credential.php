<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phone number becomes the only credential.
     *
     * There is no password and no Google identity: proving you control the
     * number is the whole of authentication, for signing in and signing up
     * alike. That makes `users.password` not merely optional but wrong to
     * keep a nullable password column invites code that treats "no password"
     * as "any password".
     *
     * `name` becomes nullable because the account now exists the moment a code
     * is verified, which can be before anyone has been asked their name.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['password', 'google_id']);
            $table->string('name')->nullable()->change();
        });

        Schema::table('phone_verification_codes', function (Blueprint $table) {
            // Which channel actually carried the code. Recorded so a failed
            // WhatsApp attempt followed by an SMS is visible after the fact.
            $table->string('channel', 20)->default('sms')->after('purpose');
        });

        // Password resets have no meaning without passwords.
        Schema::dropIfExists('password_reset_tokens');
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->after('email_verified_at');
            $table->string('google_id')->nullable()->unique()->after('email_verified_at');
            $table->string('name')->nullable(false)->change();
        });

        Schema::table('phone_verification_codes', function (Blueprint $table) {
            $table->dropColumn('channel');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }
};
