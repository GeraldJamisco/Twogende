<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'method' => $this->method->value,
            'method_label' => $this->method->label(),
            'provider' => $this->method->provider(),
            'status' => $this->status->value,
            'amount' => $this->amount,
            'currency' => $this->currency,

            // What the passenger reads back to us when something goes wrong.
            'reference' => $this->reference,

            'payer_phone' => $this->payer_phone,
            'requested_at' => $this->requested_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
        ];
    }
}
