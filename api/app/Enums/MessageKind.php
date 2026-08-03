<?php

namespace App\Enums;

enum MessageKind: string
{
    /** Typed by one of the two people. */
    case User = 'user';

    /** Written by Twogende — arrival notices and the like. */
    case System = 'system';

    /** A dropped pin. */
    case Location = 'location';

    /** A photo, usually of where somebody is standing. */
    case Image = 'image';

    /** Kinds a person is allowed to send. System notices are ours to write. */
    public static function sendable(): array
    {
        return [self::User->value, self::Location->value, self::Image->value];
    }
}
