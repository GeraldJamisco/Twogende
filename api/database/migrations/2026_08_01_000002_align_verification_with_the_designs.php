<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Brings the schema in line with "Twogende Driver Verification.dc.html".
     */
    public function up(): void
    {
        Schema::table('identity_verifications', function (Blueprint $table) {
            // The design asks for a date of birth; there was nowhere to put it.
            $table->date('date_of_birth')->nullable()->after('full_name_on_document');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            /*
             * The design asks the driver for the last four characters of the
             * plate, not the whole thing - and its own trust note promises
             * passengers never see the plate number.
             *
             * So the driver supplies the suffix, which is all a passenger needs
             * to pick the right car out of a queue, and the full plate is read
             * off the vehicle photo during review. That keeps plate_number
             * meaningful and unique for vehicles that have been checked,
             * without asking the driver to type it.
             */
            $table->string('plate_last4', 8)->nullable()->after('plate_number');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            // Nullable until a reviewer fills it in from the photo. MySQL
            // permits many NULLs under a unique index, so the constraint still
            // does its job for every vehicle that has been reviewed.
            $table->string('plate_number', 20)->nullable()->change();

            /*
             * The design collects "Make & model" as one field, because that's
             * how people say it. Splitting "Land Rover Discovery" on the first
             * space would produce nonsense, so the whole string lives in `make`
             * and `model` becomes optional.
             */
            $table->string('model', 60)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('identity_verifications', function (Blueprint $table) {
            $table->dropColumn('date_of_birth');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn('plate_last4');
            $table->string('plate_number', 20)->nullable(false)->change();
            $table->string('model', 60)->nullable(false)->change();
        });
    }
};
