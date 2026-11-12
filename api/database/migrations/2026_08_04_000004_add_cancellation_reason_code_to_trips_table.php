<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Splits "why was this cancelled" into the part we count and the part the
     * driver wrote.
     *
     * cancellation_reason has been free text since the table was created. It
     * keeps that job under a clearer name - a note - and the new column holds
     * one of a fixed set of codes, which is the only form a reason can take if
     * anyone is ever going to ask how often vehicles break down.
     */
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->string('cancellation_reason_code', 40)->nullable()->after('cancelled_at');
            $table->renameColumn('cancellation_reason', 'cancellation_note');
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->renameColumn('cancellation_note', 'cancellation_reason');
            $table->dropColumn('cancellation_reason_code');
        });
    }
};
