<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Continue with Google" replaces the password step, not the phone step.
     *
     * Google returns no phone number, and a Twogende account without one
     * cannot be contacted for the WhatsApp handoff that every booking ends
     * with so `phone` stays NOT NULL and a Google sign-up still goes through
     * OTP. What changes is that such a user never sets a password.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Google's stable subject claim. Unique, but nullable most users
            // will still register with a phone and password.
            $table->string('google_id')->nullable()->unique()->after('email_verified_at');
        });

        // Laravel's change() needs the column redefined in full. Splitting it
        // into its own statement keeps the intent obvious in the diff.
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
        });
    }
};
