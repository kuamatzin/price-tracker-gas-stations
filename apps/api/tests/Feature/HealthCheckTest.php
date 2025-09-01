<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    /**
     * Test that the application returns a successful response.
     */
    public function test_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }

    /**
     * Test that the API health endpoint works.
     */
    public function test_api_health_endpoint_returns_success(): void
    {
        $response = $this->getJson('/api/health');

        // Health endpoint should return either 200 (healthy) or 503 (unhealthy)
        $this->assertContains($response->getStatusCode(), [200, 503]);

        $response->assertJsonStructure([
            'status',
            'timestamp',
            'services' => [
                'database',
                'redis',
                'scraper',
                'scraper_integration',
            ],
            'data_freshness',
            'version' => [
                'api',
                'laravel',
                'php',
            ],
            'response_time_ms',
        ]);

        // Status can be healthy, degraded, or unhealthy depending on services
        $this->assertContains($response->json('status'), ['healthy', 'degraded', 'unhealthy']);
    }
}
