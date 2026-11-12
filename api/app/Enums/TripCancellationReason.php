<?php

namespace App\Enums;

/**
 * Why a driver called a ride off.
 *
 * Stored as a code rather than the label, for the same reason rating tags are:
 * "Not enough passengers" is a sentence we may reword, and a reworded sentence
 * would silently split one reason into two the next time anybody counts them.
 *
 * The free text a driver types under "Other" is kept separately, in
 * cancellation_note. It is theirs to explain with; this is ours to count.
 */
enum TripCancellationReason: string
{
    case VehicleProblem = 'vehicle_problem';
    case NotEnoughPassengers = 'not_enough_passengers';
    case PersonalEmergency = 'personal_emergency';
    case ChangedPlans = 'changed_plans';
    case Weather = 'weather';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::VehicleProblem => 'Vehicle problem',
            self::NotEnoughPassengers => 'Not enough passengers',
            self::PersonalEmergency => 'Personal emergency',
            self::ChangedPlans => 'Changed my plans',
            self::Weather => 'Weather / road conditions',
            self::Other => 'Other',
        };
    }

    /**
     * What the passenger is told, in the conversation.
     *
     * Deliberately not the driver's own words. A passenger needs to know their
     * seat is gone and roughly why; "Changed my plans" reads as an accusation
     * when it arrives cold, and the exact reason is between the driver and us.
     */
    public function passengerNotice(): string
    {
        return match ($this) {
            self::VehicleProblem => 'the driver has had a problem with the vehicle',
            self::NotEnoughPassengers => 'the ride did not fill up',
            self::PersonalEmergency => 'the driver has had an emergency',
            self::Weather => 'of the weather and road conditions',
            self::ChangedPlans, self::Other => 'the driver can no longer make the journey',
        };
    }

    /** The list the cancel screen offers, in the order it shows them. */
    public static function offered(): array
    {
        return array_map(fn (self $case) => [
            'code' => $case->value,
            'label' => $case->label(),
        ], self::cases());
    }
}
