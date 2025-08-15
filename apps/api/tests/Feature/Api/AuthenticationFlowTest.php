<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Hash;

class AuthenticationFlowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that protected endpoints require authentication
     */
    public function test_protected_endpoints_require_authentication()
    {
        $protectedEndpoints = [
            ['method' => 'GET', 'url' => '/api/v1/prices/current'],
            ['method' => 'POST', 'url' => '/api/v1/prices/nearby'],
            ['method' => 'GET', 'url' => '/api/v1/trends/market'],
            ['method' => 'GET', 'url' => '/api/v1/competitors'],
            ['method' => 'GET', 'url' => '/api/v1/geo/estados'],
            ['method' => 'GET', 'url' => '/api/v1/status/dashboard'],
        ];

        foreach ($protectedEndpoints as $endpoint) {
            $response = $this->json($endpoint['method'], $endpoint['url']);
            
            $response->assertStatus(401);
            $response->assertJson([
                'error' => [
                    'code' => 'AUTHENTICATION_REQUIRED'
                ]
            ]);
        }
    }

    /**
     * Test that public endpoints don't require authentication
     */
    public function test_public_endpoints_dont_require_authentication()
    {
        $publicEndpoints = [
            '/api/health',
            '/api/v1/health',
            '/api/v1/status/health',
            '/api/documentation',
        ];

        foreach ($publicEndpoints as $endpoint) {
            $response = $this->get($endpoint);
            
            // Should not return 401
            $this->assertNotEquals(401, $response->status(),
                "Public endpoint $endpoint returned 401");
        }
    }

    /**
     * Test user registration flow
     */
    public function test_user_registration_flow()
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'station_numero' => '12345'
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'data' => [
                'user' => [
                    'id',
                    'name',
                    'email',
                ],
                'token'
            ]
        ]);

        // Verify user was created
        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'name' => 'Test User',
            'station_numero' => '12345'
        ]);
    }

    /**
     * Test user login flow
     */
    public function test_user_login_flow()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123')
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'user',
                'token'
            ]
        ]);

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);

        // Test that token works
        $authResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token
        ])->get('/api/v1/prices/current');

        $this->assertNotEquals(401, $authResponse->status());
    }

    /**
     * Test invalid login credentials
     */
    public function test_invalid_login_credentials()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123')
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword'
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    /**
     * Test logout flow
     */
    public function test_logout_flow()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/auth/logout');

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Successfully logged out'
        ]);
    }

    /**
     * Test that Sanctum tokens work correctly
     */
    public function test_sanctum_tokens_work_correctly()
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token
        ])->get('/api/v1/prices/current');

        $this->assertNotEquals(401, $response->status());
    }

    /**
     * Test that expired tokens are rejected
     */
    public function test_expired_tokens_are_rejected()
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        // Expire the token
        $user->tokens()->update(['expires_at' => now()->subDay()]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token
        ])->get('/api/v1/prices/current');

        $response->assertStatus(401);
    }

    /**
     * Test password reset flow
     */
    public function test_password_reset_flow()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com'
        ]);

        // Request password reset
        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'test@example.com'
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'message' => 'Password reset link sent'
        ]);
    }

    /**
     * Test that authentication is properly documented
     */
    public function test_authentication_is_properly_documented()
    {
        $response = $this->get('/api/documentation.json');
        $spec = $response->json();

        // Check for auth endpoints in documentation
        $authPaths = [
            '/auth/register',
            '/auth/login',
            '/auth/logout',
        ];

        foreach ($authPaths as $path) {
            $this->assertArrayHasKey($path, $spec['paths'] ?? [],
                "Auth endpoint $path not documented");
        }
    }

    /**
     * Test user profile access
     */
    public function test_user_profile_access()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/profile');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'id',
                'name',
                'email',
                'station_numero',
                'subscription_tier',
                'created_at',
            ]
        ]);
    }
}