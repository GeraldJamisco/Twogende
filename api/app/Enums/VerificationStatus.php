<?php

namespace App\Enums;

/**
 * Shared review state for anything a human moderator approves:
 * identity documents and vehicles.
 */
enum VerificationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
