<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\MobileMoneyGateway;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Values the app must not hard-code, because they are the same values the
 * admin dashboard will one day edit.
 *
 * The commission rate is the reason this exists. It appears in the Terms of
 * service, on the driver's earnings summary, and in the fee taken at
 * completion. Typed into three places it drifts, and a Terms page quoting a
 * percentage the app does not charge is the kind of disagreement that gets
 * read out in a dispute.
 */
class PlatformConfigController extends Controller
{
    public function __invoke(MobileMoneyGateway $gateway): JsonResponse
    {
        return response()->json([
            'data' => [
                'commission_rate' => (float) config('twogende.platform.commission_rate'),
                'currency' => 'UGX',
                'support_email' => (string) config('twogende.support.email'),
                'privacy_email' => (string) config('twogende.support.privacy_email'),

                /*
                 * Every way Twogende will ever take a contribution, whether or
                 * not it works yet. This is the constant list the settings
                 * screen shows; which one is actually used is chosen per trip
                 * on the payment screen, because a person pays one driver in
                 * cash and the next by phone.
                 *
                 * Availability is asked rather than assumed, so nothing here
                 * can promise a method the app cannot complete.
                 */
                'payment_methods' => [
                    [
                        'key' => 'cash',
                        'label' => 'Cash',
                        'note' => 'Handed to the driver at the destination.',
                        // Two people and a destination. Nothing to connect.
                        'available' => true,
                    ],
                    [
                        'key' => 'mobile_money',
                        'label' => 'Mobile money',
                        'note' => 'MTN Mobile Money and Airtel Money, paid straight to the driver.',
                        'available' => $gateway->isAvailable(PaymentMethod::Mtn)
                            || $gateway->isAvailable(PaymentMethod::Airtel),
                    ],
                    [
                        'key' => 'bank',
                        'label' => 'Bank transfer',
                        'note' => 'For longer routes and regular riders.',
                        'available' => false,
                    ],
                    [
                        'key' => 'flowpesa',
                        'label' => 'FlowPesa',
                        'note' => 'The Twogende wallet. Top up once, ride all week.',
                        'available' => false,
                    ],
                ],
            ],
        ]);
    }
}
