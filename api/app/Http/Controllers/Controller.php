<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    /**
     * Gives every controller $this->authorize(). Policies are discovered by
     * convention App\Models\Trip resolves to App\Policies\TripPolicy so
     * there's nothing to register.
     */
    use AuthorizesRequests;
}
