<?php

namespace App\Services\Payments;

use App\Contracts\MobileMoneyGateway;
use App\Enums\PaymentMethod;
use App\Models\Payment;
use RuntimeException;

/**
 * The gateway that is bound when no aggregator is configured - which is the
 * case today, and will be until FlowPesa is signed.
 *
 * It reports itself unavailable rather than pretending. That is the whole
 * point: the payment screen asks before it offers, so a passenger is never
 * walked to the end of a flow that cannot finish, and no row is ever written
 * saying money moved when nothing did.
 */
class UnavailableGateway implements MobileMoneyGateway
{
    public function isAvailable(PaymentMethod $method): bool
    {
        return false;
    }

    public function requestApproval(Payment $payment): string
    {
        throw new RuntimeException(
            'No mobile money gateway is configured. Set PAYMENTS_GATEWAY once an aggregator is connected.'
        );
    }
}
