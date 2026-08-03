<?php

use App\Http\Controllers\Dev\DevConsoleController;
use App\Http\Middleware\EnsureLocalEnvironment;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Developer console
|--------------------------------------------------------------------------
|
| Local-only tooling for exercising the API by hand. This file is registered
| from bootstrap/app.php only when the app is running locally, and every route
| carries the environment guard as well.
|
| No 'web' middleware: there's no session or CSRF here, which keeps the page's
| fetch() calls plain.
|
*/

Route::middleware(EnsureLocalEnvironment::class)->prefix('dev')->name('dev.')->group(function () {
    Route::get('/', [DevConsoleController::class, 'index'])->name('console');
    Route::get('state', [DevConsoleController::class, 'state'])->name('state');
    Route::get('outbox', [DevConsoleController::class, 'outbox'])->name('outbox');
    Route::delete('outbox', [DevConsoleController::class, 'clearOutbox'])->name('outbox.clear');
    Route::post('seed', [DevConsoleController::class, 'seed'])->name('seed');
    Route::post('reset', [DevConsoleController::class, 'reset'])->name('reset');
});
