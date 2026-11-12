<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One record per attempt to settle a booking's contribution.
     *
     * A row rather than a couple of columns on bookings, because mobile money
     * is asynchronous: a request goes to a handset, and the answer comes back
     * minutes later down a different wire. Something has to hold the attempt
     * in the meantime, and a failed attempt followed by a successful one is
     * two facts, not one overwritten field.
     *
     * Money is whole shillings, as everywhere else - UGX has no subunit in
     * practice.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();

            // Denormalised from the booking so a payment can be read on its
            // own - a statement should not have to walk back to a trip to say
            // who paid whom.
            $table->foreignId('payer_id')->constrained('users');
            $table->foreignId('payee_id')->constrained('users');

            $table->string('method', 20);
            $table->string('status', 30)->default('pending');

            $table->unsignedInteger('amount');
            $table->char('currency', 3)->default('UGX');

            /*
             * Shown to the passenger as proof, so it has to be unique and it
             * has to be ours - a provider's reference is not guaranteed to
             * exist by the time we need something to put on the screen.
             */
            $table->string('reference', 20)->unique();

            // Where the request was sent. Not necessarily the account's own
            // number: the design lets somebody pay from a different handset.
            $table->string('payer_phone')->nullable();

            // Whatever the aggregator calls this attempt, for reconciliation.
            $table->string('provider_reference')->nullable()->index();

            $table->timestamp('requested_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('failure_reason')->nullable();

            $table->timestamps();

            // "Has this booking been settled?" is the question asked most.
            $table->index(['booking_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
