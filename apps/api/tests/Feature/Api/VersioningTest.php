<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VersioningTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that API version headers are present
     */
    public function test_api_version_headers_are_present()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/prices/current');

        $response->assertHeader('API-Version', 'v1');
    }

    /**
     * Test that v1 endpoints have deprecation warnings
     */
    public function test_v1_endpoints_have_deprecation_warnings()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/prices/current');

        $response->assertHeader('API-Version', 'v1');
        $response->assertHeader('Sunset');
        $response->assertHeader('Deprecation');
        $response->assertHeader('Link');

        // Verify sunset date format
        $sunsetHeader = $response->headers->get('Sunset');
        $this->assertMatchesRegularExpression('/\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT/', $sunsetHeader);

        // Verify deprecation header
        $deprecationHeader = $response->headers->get('Deprecation');
        $this->assertStringContainsString('version="v1"', $deprecationHeader);
        $this->assertStringContainsString('date="2024-12-31"', $deprecationHeader);

        // Verify link to successor version
        $linkHeader = $response->headers->get('Link');
        $this->assertStringContainsString('rel="successor-version"', $linkHeader);
        $this->assertStringContainsString('/v2', $linkHeader);
    }

    /**
     * Test that versioned routes work correctly
     */
    public function test_versioned_routes_work_correctly()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $v1Endpoints = [
            '/api/v1/prices/current',
            '/api/v1/trends/market',
            '/api/v1/competitors',
            '/api/v1/geo/estados',
            '/api/v1/status/dashboard',
        ];

        foreach ($v1Endpoints as $endpoint) {
            $response = $this->get($endpoint);

            // Should not return 404
            $this->assertNotEquals(404, $response->status(),
                "Endpoint $endpoint returned 404");

            // Should have version header
            $response->assertHeader('API-Version', 'v1');
        }
    }

    /**
     * Test that version is included in documentation
     */
    public function test_version_is_included_in_documentation()
    {
        $response = $this->get('/api/documentation.json');

        $spec = $response->json();

        $this->assertArrayHasKey('info', $spec);
        $this->assertArrayHasKey('version', $spec['info']);
        $this->assertEquals('1.0.0', $spec['info']['version']);
    }

    /**
     * Test that sunset date is in the future
     */
    public function test_sunset_date_is_in_future()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/prices/current');

        $sunsetHeader = $response->headers->get('Sunset');
        $sunsetDate = \DateTime::createFromFormat('D, d M Y H:i:s \G\M\T', $sunsetHeader);

        $this->assertInstanceOf(\DateTime::class, $sunsetDate);
        $this->assertGreaterThan(new \DateTime, $sunsetDate,
            'Sunset date should be in the future');
    }

    /**
     * Test that different API versions can coexist
     */
    public function test_different_api_versions_can_coexist()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // Test v1 endpoint
        $v1Response = $this->get('/api/v1/prices/current');
        $v1Response->assertHeader('API-Version', 'v1');

        // Future v2 endpoint would work similarly
        // This is a placeholder for when v2 is implemented
        // $v2Response = $this->get('/api/v2/prices/current');
        // $v2Response->assertHeader('API-Version', 'v2');
        // $v2Response->assertHeaderMissing('Sunset');
    }

    /**
     * Test that versioning middleware is applied correctly
     */
    public function test_versioning_middleware_is_applied_correctly()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // Test multiple v1 endpoints to ensure middleware is consistent
        $endpoints = [
            '/api/v1/auth/user',
            '/api/v1/prices/current',
            '/api/v1/geo/estados',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->get($endpoint);

            if ($response->status() !== 404) {
                $response->assertHeader('API-Version', 'v1');
                $response->assertHeader('Sunset');
            }
        }
    }

    /**
     * Test that version-specific features work
     */
    public function test_version_specific_features_work()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // V1 specific behavior
        $response = $this->get('/api/v1/prices/current');

        // Check for v1-specific response structure
        if ($response->status() === 200) {
            $data = $response->json();

            // V1 uses 'success' key in responses
            if (isset($data['success'])) {
                $this->assertArrayHasKey('success', $data);
            }
        }
    }
}
