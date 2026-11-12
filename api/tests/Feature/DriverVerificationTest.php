<?php

namespace Tests\Feature;

use App\Enums\IdentityDocumentType;
use App\Enums\VerificationStatus;
use App\Models\IdentityVerification;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The two steps of "Twogende Driver Verification.dc.html".
 */
class DriverVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        // PNG rather than JPEG: this PHP's GD is built without imagejpeg(),
        // so a faked .jpg cannot actually be generated.
        Storage::fake('local');
        Storage::fake('public');

        $this->user = User::factory()->create(['name' => 'Grace Achen']);
        Sanctum::actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function identityPayload(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Achen Grace Nakato',
            'date_of_birth' => '1994-03-18',
            'id_type' => 'license',
            'id_number' => 'DL-0234891',
            'id_photo' => UploadedFile::fake()->image('id.png'),
            'selfie' => UploadedFile::fake()->image('selfie.png'),
        ], $overrides);
    }

    // Step 1 - identity

    public function test_identity_documents_can_be_submitted_for_review(): void
    {
        $this->postJson('/api/v1/me/identity', $this->identityPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.document_type', 'driving_permit');

        $record = IdentityVerification::query()->sole();
        $this->assertSame('Achen Grace Nakato', $record->full_name_on_document);
        $this->assertSame('1994-03-18', $record->date_of_birth->toDateString());
        $this->assertSame(VerificationStatus::Pending, $record->status);
    }

    public function test_documents_are_stored_privately_and_never_exposed(): void
    {
        $response = $this->postJson('/api/v1/me/identity', $this->identityPayload())->assertCreated();

        $record = IdentityVerification::query()->sole();

        // An ID document and a face behind a public URL is a breach waiting to
        // be found, so these live on the private disk.
        Storage::disk('local')->assertExists($record->front_image_path);
        Storage::disk('local')->assertExists($record->selfie_image_path);
        Storage::disk('public')->assertMissing($record->front_image_path);

        // And nothing about them reaches the client.
        $body = $response->getContent();
        $this->assertStringNotContainsString($record->front_image_path, $body);
        $this->assertStringNotContainsString($record->selfie_image_path, $body);
        $this->assertStringNotContainsString('DL-0234891', $body);
        $this->assertStringNotContainsString('1994-03-18', $body);
    }

    public function test_each_id_type_maps_to_the_right_document(): void
    {
        $cases = [
            'license' => IdentityDocumentType::DrivingPermit,
            'national' => IdentityDocumentType::NationalId,
            'passport' => IdentityDocumentType::Passport,
        ];

        foreach ($cases as $input => $expected) {
            IdentityVerification::query()->delete();

            $this->postJson('/api/v1/me/identity', $this->identityPayload(['id_type' => $input]))
                ->assertCreated();

            $this->assertSame($expected, IdentityVerification::query()->sole()->document_type);
        }
    }

    public function test_somebody_under_eighteen_cannot_submit(): void
    {
        $this->postJson('/api/v1/me/identity', $this->identityPayload([
            'date_of_birth' => now()->subYears(16)->toDateString(),
        ]))->assertStatus(422)->assertJsonValidationErrors('date_of_birth');
    }

    public function test_both_photos_are_required(): void
    {
        $payload = $this->identityPayload();
        unset($payload['selfie']);

        $this->postJson('/api/v1/me/identity', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('selfie');
    }

    public function test_a_second_submission_is_refused_while_one_is_under_review(): void
    {
        $this->postJson('/api/v1/me/identity', $this->identityPayload())->assertCreated();

        $this->postJson('/api/v1/me/identity', $this->identityPayload())->assertStatus(409);

        $this->assertSame(1, IdentityVerification::query()->count());
    }

    public function test_the_status_endpoint_reports_where_a_submission_stands(): void
    {
        $this->getJson('/api/v1/me/identity')
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('identity_verified', false);

        $this->postJson('/api/v1/me/identity', $this->identityPayload())->assertCreated();

        $this->getJson('/api/v1/me/identity')
            ->assertOk()
            ->assertJsonPath('data.status', 'pending');
    }

    // Step 2 - vehicle

    public function test_a_vehicle_can_be_added(): void
    {
        $this->postJson('/api/v1/vehicles', [
            'make_and_model' => 'Toyota Premio',
            'colour' => 'Silver',
            'plate_last4' => '402k',
            'photo' => UploadedFile::fake()->image('car.png'),
        ])->assertCreated()
            ->assertJsonPath('data.description', 'Silver Toyota Premio')
            ->assertJsonPath('data.plate_last4', '402K')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.verified', false);
    }

    public function test_a_multi_word_make_survives_intact(): void
    {
        // Splitting "Land Rover Discovery" on the first space would mangle it,
        // which is why the whole string is kept together.
        $this->postJson('/api/v1/vehicles', [
            'make_and_model' => 'Land Rover Discovery',
            'colour' => 'White',
            'plate_last4' => '881B',
            'photo' => UploadedFile::fake()->image('car.png'),
        ])->assertCreated()
            ->assertJsonPath('data.description', 'White Land Rover Discovery');
    }

    public function test_the_full_plate_is_never_asked_for_or_returned(): void
    {
        $response = $this->postJson('/api/v1/vehicles', [
            'make_and_model' => 'Toyota Premio',
            'colour' => 'Silver',
            'plate_last4' => '402K',
            'photo' => UploadedFile::fake()->image('car.png'),
        ])->assertCreated();

        $vehicle = Vehicle::query()->sole();

        // The driver supplies four characters; the full plate is read off the
        // photo during review, and the design promises passengers never see it.
        $this->assertNull($vehicle->plate_number);
        $this->assertSame('402K', $vehicle->plate_last4);
        $response->assertJsonMissingPath('data.plate_number');
    }

    public function test_the_car_photo_is_public_because_it_appears_on_trip_cards(): void
    {
        $this->postJson('/api/v1/vehicles', [
            'make_and_model' => 'Toyota Premio',
            'colour' => 'Silver',
            'plate_last4' => '402K',
            'photo' => UploadedFile::fake()->image('car.png'),
        ])->assertCreated();

        Storage::disk('public')->assertExists(Vehicle::query()->sole()->photo_path);
    }

    public function test_a_plate_suffix_must_be_four_characters(): void
    {
        $this->postJson('/api/v1/vehicles', [
            'make_and_model' => 'Toyota Premio',
            'colour' => 'Silver',
            'plate_last4' => '40',
            'photo' => UploadedFile::fake()->image('car.png'),
        ])->assertStatus(422)->assertJsonValidationErrors('plate_last4');
    }

    public function test_a_driver_only_sees_their_own_vehicles(): void
    {
        Vehicle::factory()->for($this->user, 'owner')->create();
        Vehicle::factory()->create(); // somebody else's

        $this->getJson('/api/v1/vehicles')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_a_driver_cannot_remove_somebody_elses_vehicle(): void
    {
        $strangers = Vehicle::factory()->create();

        $this->deleteJson("/api/v1/vehicles/{$strangers->id}")->assertForbidden();
    }

    public function test_verification_is_only_for_the_signed_in(): void
    {
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer nonsense')
            ->postJson('/api/v1/me/identity', [])
            ->assertUnauthorized();
    }
}
