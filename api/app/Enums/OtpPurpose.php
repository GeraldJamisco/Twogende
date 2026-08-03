<?php

namespace App\Enums;

/**
 * Codes are scoped by purpose so a code issued to confirm a new number can't
 * be replayed to log in.
 */
enum OtpPurpose: string
{
    case Registration = 'registration';
    case Login = 'login';
    case PhoneChange = 'phone_change';
}
