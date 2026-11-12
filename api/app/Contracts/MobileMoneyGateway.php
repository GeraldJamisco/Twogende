<?php

namespace App\Contracts;

use App\Enums\PaymentMethod;
use App\Models\Payment;

/**
 * The seam between the app and whichever mobile money aggregator sits in front
 * of MTN and Airtel. Nothing above this interface should know FlowPesa exists.
 *
 * Two calls, because that is the shape of every mobile money API in the
 * region: you push a request to a handset and the answer arrives later, out of
 * band. Nothing here returns "paid" synchronously, and no caller should be
 * written as though it might.
 */
interface MobileMoneyGateway
{
    /**
     * Whether this gateway can reach a provider at all right now.
     *
     * Asked before anything is offered to a passenger. A screen that lets
     * somebody choose MTN and then fails at the last step is worse than one
     * that says up front it cannot.
     */
    public function isAvailable(PaymentMethod $method): bool;

    /**
     * Push a payment request to the payer's handset.
     *
     * Returns the provider's own reference for the attempt, which is what a
     * later callback will be matched against. Throws if the request could not
     * be sent - a payment that was never asked for must not be recorded as
     * though it were.
     */
    public function requestApproval(Payment $payment): string;
}
