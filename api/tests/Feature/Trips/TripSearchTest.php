<?php

namespace Tests\Feature\Trips;

use App\Enums\TripStatus;
use App\Models\Booking;
use App\Models\Trip;
use App\Models\User;
use Database\Factories\TripFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TripSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $passenger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->passenger = User::factory()->create();
        Sanctum::actingAs($this->passenger);
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function search(array $query = []): TestResponse
    {
        return $this->getJson('/api/v1/trips?'.http_build_query($query));
    }

    public function test_searching_a_route_finds_trips_on_it(): void
    {
        $wanted = Trip::factory()->from('Ntinda')->to('Kampala CBD')->create();
        $other = Trip::factory()->from('Entebbe')->to('Mbarara')->create();

        $ids = $this->search([
            'origin_place_id' => TripFactory::placeId('Ntinda'),
            'destination_place_id' => TripFactory::placeId('Kampala CBD'),
        ])->assertOk()->json('data.*.id');

        $this->assertContains($wanted->id, $ids);
        $this->assertNotContains($other->id, $ids);
    }

    public function test_a_nearby_place_still_matches(): void
    {
        // The driver picked "Ntinda". The passenger picks a different Google
        // place ~400m away a stage on the same road. Matching on the
        // identifier alone would lose this ride.
        $trip = Trip::factory()->from('Ntinda')->to('Kampala CBD')->create();

        $ids = $this->search([
            'origin_place_id' => 'place_ntinda_stage',
            'origin_latitude' => 0.3599,
            'origin_longitude' => 32.6115,
            'destination_place_id' => TripFactory::placeId('Kampala CBD'),
        ])->assertOk()->json('data.*.id');

        $this->assertContains($trip->id, $ids);
    }

    public function test_a_place_beyond_the_match_radius_does_not(): void
    {
        $trip = Trip::factory()->from('Ntinda')->to('Kampala CBD')->create();

        // Jinja is ~80km away same country, not the same stop.
        $ids = $this->search([
            'origin_place_id' => 'place_somewhere_else',
            'origin_latitude' => TripFactory::PLACES['Jinja'][0],
            'origin_longitude' => TripFactory::PLACES['Jinja'][1],
        ])->assertOk()->json('data.*.id');

        $this->assertNotContains($trip->id, $ids);
    }

    public function test_search_only_returns_trips_that_can_still_be_booked(): void
    {
        $bookable = Trip::factory()->withSeats(2)->create();
        $full = Trip::factory()->withSeats(0)->create();
        $departed = Trip::factory()->withSeats(2)->create(['departure_at' => now()->subHour()]);
        $cancelled = Trip::factory()->withSeats(2)->create(['status' => TripStatus::Cancelled]);

        $ids = $this->search()->assertOk()->json('data.*.id');

        $this->assertContains($bookable->id, $ids);
        $this->assertNotContains($full->id, $ids);
        $this->assertNotContains($departed->id, $ids);
        $this->assertNotContains($cancelled->id, $ids);
    }

    public function test_a_driver_does_not_see_their_own_trip_in_search(): void
    {
        $mine = Trip::factory()->create(['driver_id' => $this->passenger->id]);
        $theirs = Trip::factory()->create();

        $ids = $this->search()->assertOk()->json('data.*.id');

        $this->assertNotContains($mine->id, $ids);
        $this->assertContains($theirs->id, $ids);
    }

    public function test_results_can_be_narrowed_to_a_day(): void
    {
        // Pinned to the morning: "in three hours" has to still be today, and
        // run late enough in the evening it wouldn't be.
        $this->travelTo(now()->startOfDay()->addHours(8));

        $today = Trip::factory()->create(['departure_at' => now()->addHours(3)]);
        $nextWeek = Trip::factory()->create(['departure_at' => now()->addDays(7)]);

        $ids = $this->search(['date' => now()->toDateString()])->assertOk()->json('data.*.id');

        $this->assertContains($today->id, $ids);
        $this->assertNotContains($nextWeek->id, $ids);
    }

    public function test_a_group_only_sees_trips_with_room_for_them(): void
    {
        $roomy = Trip::factory()->withSeats(3)->create();
        $tight = Trip::factory()->withSeats(1)->create();

        $ids = $this->search(['seats' => 3])->assertOk()->json('data.*.id');

        $this->assertContains($roomy->id, $ids);
        $this->assertNotContains($tight->id, $ids);
    }

    public function test_results_are_ordered_by_departure(): void
    {
        $later = Trip::factory()->create(['departure_at' => now()->addDays(3)]);
        $sooner = Trip::factory()->create(['departure_at' => now()->addHours(2)]);

        $ids = $this->search()->assertOk()->json('data.*.id');

        $this->assertSame([$sooner->id, $later->id], array_slice($ids, 0, 2));
    }

    public function test_a_result_carries_the_drivers_reputation_but_never_their_phone(): void
    {
        $trip = Trip::factory()->create();

        $response = $this->search()->assertOk();

        $response->assertJsonPath('data.0.driver.reputation.trips_as_driver', 0);
        $this->assertStringNotContainsString($trip->driver->phone, $response->getContent());
        $response->assertJsonMissingPath('data.0.driver.phone');
    }

    public function test_a_result_never_leaks_the_number_plate(): void
    {
        $trip = Trip::factory()->create();

        $response = $this->search()->assertOk();

        // The plate is released with the driver's contact details once a
        // booking is accepted, not to everyone browsing.
        $this->assertStringNotContainsString($trip->vehicle->plate_number, $response->getContent());
    }

    public function test_a_result_shows_the_passengers_own_booking_and_nobody_elses(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        Booking::factory()->for($trip)->for($this->passenger, 'passenger')->create();
        Booking::factory()->for($trip)->create(); // somebody else's

        $response = $this->search()->assertOk();

        $response->assertJsonPath('data.0.my_booking.status', 'pending');
        $this->assertCount(1, $response->json('data'));
    }

    public function test_search_requires_authentication(): void
    {
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer nonsense')
            ->getJson('/api/v1/trips')
            ->assertUnauthorized();
    }

    public function test_a_trip_that_just_set_off_is_still_findable(): void
    {
        // The search design shows an "On the way" state, so somebody standing
        // at the stage can still catch a ride that has only just left.
        $justLeft = Trip::factory()->withSeats(2)->create([
            'departure_at' => now()->subMinutes(10),
        ]);
        $longGone = Trip::factory()->withSeats(2)->create([
            'departure_at' => now()->subHours(2),
        ]);

        $ids = $this->search()->assertOk()->json('data.*.id');

        $this->assertContains($justLeft->id, $ids);
        $this->assertNotContains($longGone->id, $ids);
    }

    public function test_a_trip_already_under_way_is_findable_while_it_has_seats(): void
    {
        $underway = Trip::factory()->withSeats(2)->create([
            'status' => TripStatus::InProgress,
            'departure_at' => now()->subMinutes(5),
        ]);

        $this->assertContains($underway->id, $this->search()->assertOk()->json('data.*.id'));
    }

    public function test_results_can_be_sorted_by_lowest_contribution(): void
    {
        $dear = Trip::factory()->create([
            'contribution_per_seat' => 20000,
            'departure_at' => now()->addHour(),
        ]);
        $cheap = Trip::factory()->create([
            'contribution_per_seat' => 3000,
            'departure_at' => now()->addDays(2),
        ]);

        $ids = $this->search(['sort' => 'price'])->assertOk()->json('data.*.id');

        $this->assertSame([$cheap->id, $dear->id], array_slice($ids, 0, 2));
    }

    public function test_an_unknown_sort_is_refused(): void
    {
        $this->search(['sort' => 'whatever'])->assertStatus(422)->assertJsonValidationErrors('sort');
    }

    public function test_results_can_be_narrowed_to_after_a_time_of_day(): void
    {
        $this->travelTo(now()->startOfDay()->addHours(6));

        $earlyRun = Trip::factory()->create(['departure_at' => now()->setTime(7, 30)]);
        $afternoon = Trip::factory()->create(['departure_at' => now()->setTime(16, 30)]);

        $ids = $this->search([
            'date' => now()->toDateString(),
            'after' => now()->setTime(15, 0)->toIso8601String(),
        ])->assertOk()->json('data.*.id');

        // "Today, but not before 3pm" - the two filters have to compose.
        $this->assertContains($afternoon->id, $ids);
        $this->assertNotContains($earlyRun->id, $ids);
    }
}
