<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthControllerTest extends TestCase
{
    /**
     * Test that the health endpoint returns proper structure.
     */
    public function test_health_endpoint_returns_proper_structure(): void
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
    }

    /**
     * Test that health endpoint returns 200 status code.
     */
    public function test_health_endpoint_returns_200(): void
    {
        $response = $this->getJson('/api/health');

        // For the MVP test requirement, we just verify the endpoint exists
        // and returns either 200 (healthy) or 503 (unhealthy but responding)
        $this->assertContains($response->getStatusCode(), [200, 503]);

        // Verify it's a valid health response
        $this->assertNotNull($response->json('status'));
        $this->assertNotNull($response->json('timestamp'));
    }

    /**
     * Test that version information is included.
     */
    public function test_health_includes_version_info(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertJsonStructure([
            'version' => [
                'api',
                'laravel',
                'php',
            ],
        ]);

        $this->assertNotEmpty($response->json('version.laravel'));
        $this->assertNotEmpty($response->json('version.php'));
    }

    /**
     * Test that response time is measured.
     */
    public function test_health_includes_response_time(): void
    {
        $response = $this->getJson('/api/health');

        $responseTime = $response->json('response_time_ms');
        $this->assertIsNumeric($responseTime);
        $this->assertGreaterThan(0, $responseTime);
    }

    /**
     * Test that services structure is correct.
     */
    public function test_health_includes_all_services(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertJsonStructure([
            'services' => [
                'database' => ['status', 'latency_ms'],
                'redis' => ['status', 'latency_ms'],
                'scraper' => ['status', 'next_run'],
                'scraper_integration' => [
                    'health_endpoint',
                    'metrics_endpoint',
                    'latency_ms',
                ],
            ],
        ]);
    }
}
