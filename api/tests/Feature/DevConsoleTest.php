<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The console is local-only tooling. These tests are here to make sure it
 * stays that way and that the page itself doesn't rot.
 */
class DevConsoleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_console_renders_locally(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->get('/dev')->assertOk()->assertSee('Twogende API console');
    }

    public function test_the_state_endpoint_reports_every_table(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->getJson('/dev/state')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'counts' => ['users', 'codes', 'vehicles', 'trips', 'bookings', 'ratings', 'tokens'],
                'tables' => ['users', 'codes', 'vehicles', 'trips', 'bookings', 'ratings', 'tokens'],
            ]);
    }

    public function test_seeding_produces_something_to_look_at(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->postJson('/dev/seed')->assertOk();

        $this->assertDatabaseCount('trips', 3);
        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_the_console_is_invisible_outside_local(): void
    {
        // The routes aren't even registered in production, but the middleware
        // is the lock that has to hold if that ever changes.
        $this->app->detectEnvironment(fn () => 'production');

        $this->get('/dev')->assertNotFound();
        $this->getJson('/dev/state')->assertNotFound();
        $this->postJson('/dev/reset')->assertNotFound();
    }
}
