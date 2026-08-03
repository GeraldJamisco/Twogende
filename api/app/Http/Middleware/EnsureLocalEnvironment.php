<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the developer console. 404 rather than 403 outside local there is
 * no reason to confirm that these routes exist at all.
 *
 * This is the second lock: routes/dev.php is only registered for these same
 * environments in the first place (see bootstrap/app.php). 'testing' is
 * allowed so this guard can be exercised; production never is.
 */
class EnsureLocalEnvironment
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        return $next($request);
    }
}
