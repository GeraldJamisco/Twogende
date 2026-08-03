<?php

namespace Tests\Feature\Trips;

use App\Models\Trip;
use App\Models\User;
use Database\Factories\TripFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Backs the "Suggested USh 12k–18k for this route" line when posting a ride. this price will also be upated by the admin  this is just for the design different prices will be updated in the backend
 */
class PriceSuggestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    private function suggestion(array $query = []): TestResponse
    {
        return $this->getJson('/api/v1/trips/price-suggestion?'.http_build_query($query));
    }

    private function routeQuery(): array
    {
        return [
            'origin_place_id' => TripFactory::placeId('Kampala CBD'),
            'destination_place_id' => TripFactory::placeId('Jinja'),
        ];
    }

    private function seedRoute(array $fares): void
    {
        foreach ($fares as $fare) {
            Trip::factory()->from('Kampala CBD')->to('Jinja')->create([
                'contribution_per_seat' => $fare,
            ]);
        }
    }

    public function test_a_route_with_enough_history_gets_a_range(): void
    {
        $this->seedRoute([10000, 12000, 15000, 18000, 20000]);

        $this->suggestion($this->routeQuery())
            ->assertOk()
            ->assertJsonPath('data.currency', 'UGX')
            ->assertJsonPath('sample_size', 5);
    }

    public function test_the_range_uses_quartiles_so_one_outlier_cannot_define_it(): void
    {
        // One absurd trip among sensible ones must not stretch the range.
        $this->seedRoute([10000, 12000, 14000, 16000, 500000]);

        $response = $this->suggestion($this->routeQuery())->assertOk();

        $this->assertLessThan(500000, $response->json('data.high'));
        $this->assertGreaterThanOrEqual(10000, $response->json('data.low'));
    }

    public function test_too_little_history_produces_no_suggestion(): void
    {
        // Two data points is one person's opinion, not guidance.
        $this->seedRoute([10000, 12000]);

        $this->suggestion($this->routeQuery())
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('sample_size', 2);
    }

    public function test_free_lifts_are_left_out_of_the_range(): void
    {
        $this->seedRoute([0, 0, 12000, 14000, 16000, 18000]);

        $response = $this->suggestion($this->routeQuery())->assertOk();

        // Otherwise a couple of generous drivers drag the suggestion to zero.
        $this->assertSame(4, $response->json('sample_size'));
        $this->assertGreaterThan(0, $response->json('data.low'));
    }

    public function test_another_route_does_not_inform_this_one(): void
    {
        $this->seedRoute([10000, 12000, 14000, 16000]);

        foreach ([90000, 95000, 99000, 99500] as $fare) {
            Trip::factory()->from('Entebbe')->to('Mbarara')->create([
                'contribution_per_seat' => $fare,
            ]);
        }

        $response = $this->suggestion($this->routeQuery())->assertOk();

        $this->assertSame(4, $response->json('sample_size'));
        $this->assertLessThan(90000, $response->json('data.high'));
    }

    public function test_it_requires_authentication(): void
    {
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer nonsense')
            ->getJson('/api/v1/trips/price-suggestion')
            ->assertUnauthorized();
    }
}
