<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Message;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Messaging between a passenger and their driver, opened from the
 * "Message your driver" button on the ride-requested screen.
 */
class MessagingTest extends TestCase
{
    use RefreshDatabase;

    private function bookingWithParties(): array
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create();

        return [$booking, $booking->passenger, $trip->driver];
    }

    public function test_a_passenger_can_open_the_conversation(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", [
            'body' => 'Hello, where exactly should I wait?',
        ])->assertCreated()
            ->assertJsonPath('data.body', 'Hello, where exactly should I wait?')
            ->assertJsonPath('data.is_mine', true);
    }

    public function test_the_driver_can_reply(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Where do I wait?'])
            ->assertCreated();

        Sanctum::actingAs($driver);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'By the total station.'])
            ->assertCreated();

        $this->assertSame(2, Message::query()->count());
    }

    public function test_is_mine_is_answered_from_the_readers_point_of_view(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi'])->assertCreated();

        // The same message is "mine" to one party and not to the other.
        Sanctum::actingAs($driver);
        $this->getJson("/api/v1/bookings/{$booking->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.is_mine', false);

        Sanctum::actingAs($passenger);
        $this->getJson("/api/v1/bookings/{$booking->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.is_mine', true);
    }

    public function test_a_thread_reads_oldest_first(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        foreach (['first', 'second', 'third'] as $body) {
            $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => $body]);
        }

        $bodies = $this->getJson("/api/v1/bookings/{$booking->id}/messages")
            ->assertOk()
            ->json('data.*.body');

        $this->assertSame(['first', 'second', 'third'], $bodies);
    }

    public function test_opening_a_thread_marks_the_other_sides_messages_read(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi'])->assertCreated();

        $this->assertNull(Message::query()->sole()->read_at);

        Sanctum::actingAs($driver);
        $this->getJson("/api/v1/bookings/{$booking->id}/messages")->assertOk();

        $this->assertNotNull(Message::query()->sole()->read_at);
    }

    public function test_reading_your_own_message_does_not_mark_it_read(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi'])->assertCreated();
        $this->getJson("/api/v1/bookings/{$booking->id}/messages")->assertOk();

        // Otherwise everything would show as read the moment it was sent.
        $this->assertNull(Message::query()->sole()->read_at);
    }

    public function test_a_stranger_cannot_read_or_write(): void
    {
        [$booking] = $this->bookingWithParties();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/bookings/{$booking->id}/messages")->assertForbidden();
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi'])->assertForbidden();
    }

    public function test_an_empty_message_is_refused(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('body');
    }

    // The Chats tab

    public function test_conversations_lists_both_sides_with_unread_counts(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Where do I wait?']);

        Sanctum::actingAs($driver);
        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.with.id', $passenger->id)
            ->assertJsonPath('data.0.unread_count', 1)
            ->assertJsonPath('data.0.last_message.body', 'Where do I wait?')
            ->assertJsonPath('data.0.last_message.is_mine', false);
    }

    public function test_the_other_person_is_resolved_per_viewer(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi']);

        // The passenger sees the driver; the driver sees the passenger.
        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.with.id', $driver->id);
    }

    public function test_a_booking_nobody_has_written_on_is_not_a_conversation(): void
    {
        [, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->getJson('/api/v1/conversations')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_conversations_never_leak_the_other_partys_phone(): void
    {
        [$booking, $passenger, $driver] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi']);

        $response = $this->getJson('/api/v1/conversations')->assertOk();

        $this->assertStringNotContainsString($driver->phone, $response->getContent());
        $response->assertJsonMissingPath('data.0.with.phone');
    }

    public function test_somebody_elses_conversation_is_invisible(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();

        Sanctum::actingAs($passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Hi']);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/conversations')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_chat_closes_once_the_window_has_passed(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['departure_at' => now()->addHour()]);
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs($booking->passenger);
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'Before'])
            ->assertCreated();

        // The screen promises the chat stays open until a stated moment, so
        // that has to be enforced rather than being copy. this will have to show 10 minutes before the desitantion between the driver and the passenger not at the start of the journey
        $this->travel((int) config('twogende.chat.open_hours') + 2)->hours();

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['body' => 'After'])
            ->assertStatus(422);

        // Reading a closed conversation is still allowed.
        $this->getJson("/api/v1/bookings/{$booking->id}/messages")->assertOk();
    }

    public function test_a_booking_reports_when_its_chat_closes(): void
    {
        $trip = Trip::factory()->withSeats(3)->create(['departure_at' => now()->addHour()]);
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs($booking->passenger);

        $this->getJson("/api/v1/bookings/{$booking->id}")
            ->assertOk()
            ->assertJsonPath('data.chat.open', true)
            ->assertJsonStructure(['data' => ['chat' => ['closes_at'], 'trip' => ['driver']]]);
    }

    public function test_a_stranger_cannot_read_a_booking(): void
    {
        $trip = Trip::factory()->withSeats(3)->create();
        $booking = Booking::factory()->for($trip)->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/bookings/{$booking->id}")->assertForbidden();
    }

    public function test_the_conversation_list_says_which_chats_have_ended(): void
    {
        $live = Trip::factory()->withSeats(3)->create(['departure_at' => now()->addHours(2)]);
        $liveBooking = Booking::factory()->for($live)->create();

        Sanctum::actingAs($liveBooking->passenger);
        $this->postJson("/api/v1/bookings/{$liveBooking->id}/messages", ['body' => 'Still going']);

        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.chat.open', true);

        // Past the window, the same conversation reports itself closed — the
        // Chats screen groups on exactly this.
        $this->travel((int) config('twogende.chat.open_hours') + 3)->hours();

        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.chat.open', false);
    }

    public function test_either_side_can_drop_a_pin(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", [
            'kind' => 'location',
            'latitude' => 0.3563,
            'longitude' => 32.6103,
            'body' => 'Ntinda stage',
        ])->assertCreated()
            ->assertJsonPath('data.kind', 'location')
            ->assertJsonPath('data.location.latitude', 0.3563)
            ->assertJsonPath('data.body', 'Ntinda stage');
    }

    public function test_a_pin_without_coordinates_is_refused(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", ['kind' => 'location'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    public function test_either_side_can_send_a_photo(): void
    {
        Storage::fake('local');

        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        // PNG: this PHP's GD is built without imagejpeg().
        $response = $this->postJson("/api/v1/bookings/{$booking->id}/messages", [
            'kind' => 'image',
            'image' => UploadedFile::fake()->image('where-i-am.png'),
        ])->assertCreated()->assertJsonPath('data.kind', 'image');

        $message = Message::query()->sole();

        // A photo of where somebody is standing is a photo of where somebody
        // is - private disk, never a public URL.
        Storage::disk('local')->assertExists($message->image_path);
        Storage::disk('public')->assertMissing($message->image_path);
        $this->assertStringNotContainsString($message->image_path, $response->getContent());
    }

    public function test_a_chat_photo_is_only_visible_to_the_two_people(): void
    {
        Storage::fake('local');

        [$booking, $passenger, $driver] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        $this->postJson("/api/v1/bookings/{$booking->id}/messages", [
            'kind' => 'image',
            'image' => UploadedFile::fake()->image('where-i-am.png'),
        ])->assertCreated();

        $message = Message::query()->sole();

        Sanctum::actingAs($driver);
        $this->get("/api/v1/messages/{$message->id}/image")->assertOk();

        Sanctum::actingAs(User::factory()->create());
        $this->get("/api/v1/messages/{$message->id}/image")->assertForbidden();
    }

    public function test_nobody_can_forge_a_system_notice(): void
    {
        [$booking, $passenger] = $this->bookingWithParties();
        Sanctum::actingAs($passenger);

        // System notices are Twogende's to write. A passenger must not be able
        // to fake "your driver is here".
        $this->postJson("/api/v1/bookings/{$booking->id}/messages", [
            'kind' => 'system',
            'body' => 'Your driver is here',
        ])->assertStatus(422)->assertJsonValidationErrors('kind');
    }
}
