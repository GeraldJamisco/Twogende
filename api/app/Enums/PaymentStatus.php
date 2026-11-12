<?php

namespace App\Enums;

enum PaymentStatus: string
{
    /** Recorded, nothing asked of anyone yet. */
    case Pending = 'pending';

    /**
     * A request is sitting on the payer's handset waiting for their PIN. Only
     * mobile money reaches this state - cash has nothing to approve.
     */
    case AwaitingApproval = 'awaiting_approval';

    case Completed = 'completed';

    case Failed = 'failed';

    /** States that still expect something to happen. */
    public function isSettled(): bool
    {
        return $this === self::Completed;
    }
}
