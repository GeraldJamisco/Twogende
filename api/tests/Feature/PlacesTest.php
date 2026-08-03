<?php

namespace Tests\Feature;

use App\Contracts\PlacesProvider;
use App\Models\User;
use App\Support\Place;
use App\Support\PlaceSuggestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakePlacesProvider;
use Tests\TestCase;

class PlacesTest extends TestCase
{
    use RefreshDatabase;

    private FakePlacesProvider $places;

    protected function setUp(): void
    {
        parent::setUp();

        $this->places = new FakePlacesProvider;
        $this->app->instance(PlacesProvider::class, $this->places);

        Cache::flush();
        Sanctum::actingAs(User::factory()->create());
    }

    public function test_autocomplete_returns_suggestions(): void
    {
        $this->places->suggestions = [
            new PlaceSuggestion('place_ntinda', 'Ntinda', 'Kampala, Uganda'),
        ];

        $this->getJson('/api/v1/places/autocomplete?query=Ntin')
            ->assertOk()
            ->assertJsonPath('data.0.place_id', 'place_ntinda')
            ->assertJsonPath('data.0.primary_text', 'Ntinda');
    }

    public function test_a_gps_fix_resolves_to_a_named_place(): void
    {
        $this->places->nearestPlace = new Place(
            placeId: 'place_ntinda',
            name: 'Ntinda',
            address: 'Ntinda, Kampala, Uganda',
            latitude: 0.3506,
            longitude: 32.6157,
        );

        $this->getJson('/api/v1/places/nearest?latitude=0.3512&longitude=32.6160')
            ->assertOk()
            ->assertJsonPath('data.place_id', 'place_ntinda')
            ->assertJsonPath('data.name', 'Ntinda');

        // The handset's own coordinates are what gets looked up, not the
        // resolved place's.
        $this->assertSame(
            [['latitude' => 0.3512, 'longitude' => 32.616]],
            $this->places->nearestCalls,
        );
    }

    public function test_a_coordinate_with_nothing_nearby_is_reported_honestly(): void
    {
        $this->places->nearestPlace = null;

        // Better to say so than to hand back a place the person isn't at.
        $this->getJson('/api/v1/places/nearest?latitude=0.0&longitude=0.0')
            ->assertStatus(404);
    }

    public function test_nonsense_coordinates_are_refused(): void
    {
        $this->getJson('/api/v1/places/nearest?latitude=999&longitude=32.6')
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');

        $this->getJson('/api/v1/places/nearest')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    public function test_nearest_is_not_confused_with_a_place_id(): void
    {
        $this->places->nearestPlace = new Place('place_x', 'X', 'X', 1.0, 32.0);

        // "nearest" must route to the nearest action, not be read as an ID by
        // places/{placeId}.
        $this->getJson('/api/v1/places/nearest?latitude=0.35&longitude=32.61')
            ->assertOk()
            ->assertJsonPath('data.place_id', 'place_x');
    }

    public function test_places_endpoints_require_authentication(): void
    {
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer nonsense')
            ->getJson('/api/v1/places/nearest?latitude=0.35&longitude=32.61')
            ->assertUnauthorized();
    }
}
