<?php

namespace Tests\Feature;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test data
        $entidad = Entidad::create([
            'entidad_id' => 'CDMX',
            'nombre' => 'Ciudad de México',
        ]);

        $municipio = Municipio::create([
            'municipio_id' => 'CDMX-01',
            'nombre' => 'Cuauhtémoc',
            'entidad_id' => $entidad->entidad_id,
        ]);

        $this->station = Station::create([
            'numero' => '12345',
            'nombre' => 'Test Station',
            'franquicia' => 'PEMEX',
            'direccion' => 'Test Address',
            'municipio_id' => $municipio->municipio_id,
            'coordenadas' => ['lat' => 19.4326, 'lng' => -99.1332],
            'is_active' => true,
        ]);
    }

    public function test_user_can_register_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'Test123!',
            'password_confirmation' => 'Test123!',
            'station_numero' => $this->station->numero,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'token',
                'user' => [
                    'id',
                    'email',
                    'name',
                    'station',
                    'subscription_tier',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'name' => 'Test User',
        ]);
    }

    public function test_registration_fails_with_duplicate_email(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'existing@example.com',
            'password' => 'Test123!',
            'password_confirmation' => 'Test123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_returns_token_with_correct_expiration(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('Test123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'Test123!',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'token',
                'expires_at',
                'user',
            ]);
    }

    public function test_invalid_credentials_return_401(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('Test123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'WrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_protected_routes_require_valid_token(): void
    {
        $response = $this->getJson('/api/v1/profile');
        $response->assertStatus(401);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/profile');
        $response->assertStatus(200);
    }

    public function test_expired_tokens_are_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token');

        // Manually expire the token
        DB::table('personal_access_tokens')
            ->where('id', $token->accessToken->id)
            ->update(['created_at' => now()->subDays(2)]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
            ->getJson('/api/v1/profile');

        $response->assertStatus(401);
    }

    public function test_password_reset_email_sends_successfully(): void
    {
        $user = User::factory()->create(['email' => 'test@example.com']);

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'test@example.com',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Te hemos enviado un enlace para restablecer tu contraseña.',
            ]);

        $this->assertDatabaseHas('password_resets', [
            'email' => 'test@example.com',
        ]);
    }

    public function test_reset_token_validates_and_updates_password(): void
    {
        $user = User::factory()->create(['email' => 'test@example.com']);
        $token = 'test-reset-token';

        DB::table('password_resets')->insert([
            'email' => 'test@example.com',
            'token' => Hash::make($token),
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'test@example.com',
            'token' => $token,
            'password' => 'NewPass123!',
            'password_confirmation' => 'NewPass123!',
        ]);

        $response->assertStatus(200);

        // Verify password was changed
        $user->refresh();
        $this->assertTrue(Hash::check('NewPass123!', $user->password));
    }

    public function test_rate_limiting_blocks_after_threshold(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // Make multiple requests to trigger rate limit
        for ($i = 0; $i < 101; $i++) {
            $this->getJson('/api/v1/profile');
        }

        $response = $this->getJson('/api/v1/profile');
        $response->assertStatus(429);
    }

    public function test_different_tiers_have_different_limits(): void
    {
        $freeUser = User::factory()->create(['subscription_tier' => 'free']);
        $premiumUser = User::factory()->create(['subscription_tier' => 'premium']);

        // Test free tier
        Sanctum::actingAs($freeUser);
        $response = $this->getJson('/api/v1/profile');
        $response->assertHeader('X-RateLimit-Limit', 100);

        // Test premium tier
        Sanctum::actingAs($premiumUser);
        $response = $this->getJson('/api/v1/profile');
        $response->assertHeader('X-RateLimit-Limit', 1000);
    }

    public function test_user_profile_includes_station_data(): void
    {
        $user = User::factory()->create();
        $user->station()->create([
            'user_id' => $user->id,
            'station_numero' => $this->station->numero,
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/profile');
        $response->assertStatus(200)
            ->assertJsonPath('user.station.numero', $this->station->numero);
    }

    public function test_token_refresh_extends_expiration(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/refresh');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'token',
                'expires_at',
                'user',
            ]);
    }
}
