<?php

namespace App\Contracts;

/**
 * The seam between the app and whichever SMS gateway is in front of it.
 * Nothing above this interface should know that Africa's Talking exists.
 */
interface SmsSender
{
    /**
     * @param  string  $to  E.164 destination number.
     */
    public function send(string $to, string $message): void;
}
