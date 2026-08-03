<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AccountLookupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_a_known_number_comes_back_with_a_greeting_name(): void
    {
        User::factory()->create(['phone' => '+256701234567', 'name' => 'Achen Grace']);

        $this->postJson('/api/v1/auth/lookup', ['phone' => '0701234567'])
            ->assertOk()
            ->assertJsonPath('exists', true)
            ->assertJsonPath('greeting_name', 'Achen')
            ->assertJsonPath('phone', '+256701234567')
            ->assertJsonPath('phone_display', '0701 234 567');
    }

    public function test_only_one_word_of_the_name_is_ever_returned(): void
    {
        User::factory()->create(['phone' => '+256701234567', 'name' => 'Achen Grace Nakato']);

        $response = $this->postJson('/api/v1/auth/lookup', ['phone' => '0701234567'])->assertOk();

        // Enough to greet somebody, not enough to identify them from their
        // number alone.
        $this->assertSame('Achen', $response->json('greeting_name'));
        $this->assertStringNotContainsString('Nakato', $response->getContent());
    }

    public function test_an_unknown_number_is_reported_as_having_no_account(): void
    {
        $this->postJson('/api/v1/auth/lookup', ['phone' => '0788888888'])
            ->assertOk()
            ->assertJsonPath('exists', false)
            ->assertJsonPath('greeting_name', null);
    }

    public function test_an_account_with_no_name_yet_has_no_greeting_name(): void
    {
        // Verifying a code creates the account before anyone is asked a name.
        User::factory()->create(['phone' => '+256701234567', 'name' => null]);

        $this->postJson('/api/v1/auth/lookup', ['phone' => '0701234567'])
            ->assertOk()
            ->assertJsonPath('exists', true)
            ->assertJsonPath('greeting_name', null);
    }

    public function test_the_lookup_never_leaks_anything_beyond_one_name(): void
    {
        $user = User::factory()->create([
            'phone' => '+256701234567',
            'name' => 'Achen Grace',
            'email' => 'achen@example.com',
        ]);

        $response = $this->postJson('/api/v1/auth/lookup', ['phone' => '0701234567'])->assertOk();

        $response->assertJsonMissingPath('id');
        $response->assertJsonMissingPath('email');
        $this->assertStringNotContainsString('achen@example.com', $response->getContent());
        $this->assertStringNotContainsString((string) $user->id, $response->json('greeting_name') ?? '');
    }

    public function test_any_spelling_of_the_number_finds_the_same_account(): void
    {
        User::factory()->create(['phone' => '+256701234567', 'name' => 'Achen Grace']);

        foreach (['0701234567', '701234567', '256701234567', '+256 701 234 567'] as $spelling) {
            $this->postJson('/api/v1/auth/lookup', ['phone' => $spelling])
                ->assertOk()
                ->assertJsonPath('exists', true);
        }
    }

    public function test_a_landline_is_refused(): void
    {
        $this->postJson('/api/v1/auth/lookup', ['phone' => '0414234567'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_sweeping_a_range_of_numbers_is_throttled(): void
    {
        // The endpoint costs nothing to serve, so the rate limit is the only
        // thing standing between it and an enumeration sweep.
        for ($i = 0; $i < 8; $i++) {
            $this->postJson('/api/v1/auth/lookup', ['phone' => '07011111'.str_pad((string) $i, 2, '0', STR_PAD_LEFT)])
                ->assertOk();
        }

        $this->postJson('/api/v1/auth/lookup', ['phone' => '0709999999'])
            ->assertStatus(429);
    }
}
