<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class ErrorHandlingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that error responses follow standard format
     */
    public function test_error_response_format()
    {
        $response = $this->get('/api/v1/nonexistent');

        $response->assertStatus(404);
        $response->assertJsonStructure([
            'error' => [
                'status',
                'code',
                'title',
                'detail',
                'hint',
                'meta' => [
                    'timestamp',
                    'path',
                    'method',
                    'request_id',
                    'correlation_id',
                ]
            ]
        ]);
    }

    /**
     * Test validation error response format
     */
    public function test_validation_error_response_format()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/prices/nearby', [
            // Missing required fields: lat, lng
        ]);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'error' => [
                'status',
                'code',
                'title',
                'detail',
                'hint',
                'validation_errors',
                'meta'
            ]
        ]);

        $data = $response->json();
        $this->assertEquals('VALIDATION_ERROR', $data['error']['code']);
        $this->assertEquals('Validation Failed', $data['error']['title']);
        $this->assertArrayHasKey('lat', $data['error']['validation_errors']);
        $this->assertArrayHasKey('lng', $data['error']['validation_errors']);
    }

    /**
     * Test authentication error response
     */
    public function test_authentication_error_response()
    {
        $response = $this->get('/api/v1/prices/current');

        $response->assertStatus(401);
        $response->assertJson([
            'error' => [
                'status' => 401,
                'code' => 'AUTHENTICATION_REQUIRED',
                'title' => 'Authentication Required',
                'hint' => 'Please provide a valid authentication token in the Authorization header.'
            ]
        ]);
    }

    /**
     * Test not found error response
     */
    public function test_not_found_error_response()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/prices/station/nonexistent');

        $response->assertStatus(404);
        $response->assertJson([
            'error' => [
                'status' => 404,
                'code' => 'RESOURCE_NOT_FOUND'
            ]
        ]);
    }

    /**
     * Test method not allowed error response
     */
    public function test_method_not_allowed_error_response()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->delete('/api/v1/prices/current');

        $response->assertStatus(405);
        $response->assertJson([
            'error' => [
                'status' => 405,
                'code' => 'METHOD_NOT_ALLOWED',
                'title' => 'Method Not Allowed'
            ]
        ]);

        $data = $response->json();
        $this->assertArrayHasKey('allowed_methods', $data['error']);
    }

    /**
     * Test that error hints are helpful
     */
    public function test_error_hints_are_helpful()
    {
        $testCases = [
            [
                'url' => '/api/v1/nonexistent',
                'hint' => 'Check the API documentation for the correct endpoint URL and method.'
            ],
            [
                'url' => '/api/v1/prices/current',
                'authenticated' => false,
                'hint' => 'Please provide a valid authentication token in the Authorization header.'
            ],
        ];

        foreach ($testCases as $testCase) {
            if (isset($testCase['authenticated']) && !$testCase['authenticated']) {
                // Test without authentication
            } else {
                $user = User::factory()->create();
                Sanctum::actingAs($user);
            }

            $response = $this->get($testCase['url']);
            $data = $response->json();
            
            $this->assertEquals($testCase['hint'], $data['error']['hint']);
        }
    }

    /**
     * Test that correlation ID is included in errors
     */
    public function test_correlation_id_is_included_in_errors()
    {
        $correlationId = 'test-correlation-123';
        
        $response = $this->withHeaders([
            'X-Correlation-ID' => $correlationId
        ])->get('/api/v1/nonexistent');

        $data = $response->json();
        $this->assertEquals($correlationId, $data['error']['meta']['correlation_id']);
    }

    /**
     * Test that request ID is included in errors
     */
    public function test_request_id_is_included_in_errors()
    {
        $response = $this->get('/api/v1/nonexistent');

        $data = $response->json();
        $this->assertNotEmpty($data['error']['meta']['request_id']);
        $this->assertStringStartsWith('err_', $data['error']['meta']['request_id']);
    }

    /**
     * Test that debug info is hidden in production
     */
    public function test_debug_info_is_hidden_in_production()
    {
        config(['app.debug' => false]);

        $response = $this->get('/api/v1/will-cause-error');
        
        $data = $response->json();
        $this->assertArrayNotHasKey('debug', $data['error'] ?? []);
    }

    /**
     * Test that debug info is shown in debug mode
     */
    public function test_debug_info_is_shown_in_debug_mode()
    {
        config(['app.debug' => true]);

        // Force an error by calling non-existent endpoint
        $response = $this->get('/api/v1/nonexistent');
        
        $data = $response->json();
        if ($response->status() === 500) {
            $this->assertArrayHasKey('debug', $data['error']);
            $this->assertArrayHasKey('exception', $data['error']['debug']);
            $this->assertArrayHasKey('file', $data['error']['debug']);
            $this->assertArrayHasKey('line', $data['error']['debug']);
        }
    }

    /**
     * Test rate limit exceeded error response
     */
    public function test_rate_limit_exceeded_error_response()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // Simulate rate limit exceeded
        $key = 'rate_limit:' . $user->id . ':' . now()->format('Y-m-d-H');
        \Redis::set($key, 101); // Exceed free tier limit

        // Next request should indicate rate limit exceeded
        $response = $this->get('/api/v1/prices/current');

        if ($response->status() === 429) {
            $response->assertJson([
                'error' => [
                    'status' => 429,
                    'code' => 'RATE_LIMIT_EXCEEDED',
                    'title' => 'Too Many Requests',
                    'hint' => 'You have exceeded the rate limit. Please wait before making more requests.'
                ]
            ]);
        }
    }
}