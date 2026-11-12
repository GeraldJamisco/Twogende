<?php

namespace Tests\Support;

use App\Contracts\MobileMoneyGateway;
use App\Enums\PaymentMethod;
use App\Models\Payment;
use RuntimeException;

/**
 * Stands in for the aggregator that doesn't exist yet.
 *
 * Without this the mobile money half of the payment screen could never be
 * tested - the bound gateway refuses everything - and the day FlowPesa lands
 * would be the first time that code had ever run.
 */
class FakeMobileMoneyGateway implements MobileMoneyGateway
{
    /** @var array<int, Payment> */
    public array $requested = [];

    public function __construct(
        private bool $available = true,
        private bool $throwOnRequest = false,
    ) {}

    public function isAvailable(PaymentMethod $method): bool
    {
        return $this->available;
    }

    public function requestApproval(Payment $payment): string
    {
        if ($this->throwOnRequest) {
            throw new RuntimeException('The provider timed out.');
        }

        $this->requested[] = $payment;

        return 'FAKE-'.$payment->reference;
    }
}
