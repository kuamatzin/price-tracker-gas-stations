<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that Swagger documentation is accessible
     */
    public function test_swagger_documentation_is_accessible()
    {
        $response = $this->get('/api/documentation');

        $response->assertStatus(200);
        $response->assertSee('FuelIntel API Documentation');
    }

    /**
     * Test that OpenAPI spec is valid JSON
     */
    public function test_openapi_spec_is_valid()
    {
        $response = $this->get('/api/documentation.json');

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/json');

        $spec = $response->json();

        // Validate OpenAPI structure
        $this->assertArrayHasKey('openapi', $spec);
        $this->assertArrayHasKey('info', $spec);
        $this->assertArrayHasKey('paths', $spec);
        $this->assertArrayHasKey('components', $spec);

        // Validate version
        $this->assertEquals('3.0.0', $spec['openapi']);

        // Validate info
        $this->assertEquals('FuelIntel API Documentation', $spec['info']['title']);
        $this->assertEquals('1.0.0', $spec['info']['version']);
    }

    /**
     * Test that all documented endpoints exist
     */
    public function test_all_documented_endpoints_exist()
    {
        $response = $this->get('/api/documentation.json');
        $spec = $response->json();

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $endpoints = [
            '/api/v1/prices/current' => 'GET',
            '/api/v1/prices/nearby' => 'POST',
            '/api/v1/trends/market' => 'GET',
            '/api/v1/competitors' => 'GET',
            '/api/v1/geo/estados' => 'GET',
        ];

        foreach ($endpoints as $path => $method) {
            $pathKey = str_replace('/api/v1', '', $path);

            // Check if path is documented
            $this->assertArrayHasKey($pathKey, $spec['paths'] ?? [],
                "Path $pathKey not found in OpenAPI spec");

            // Check if method is documented
            $this->assertArrayHasKey(strtolower($method), $spec['paths'][$pathKey] ?? [],
                "Method $method not documented for path $pathKey");
        }
    }

    /**
     * Test that authentication is properly documented
     */
    public function test_authentication_is_documented()
    {
        $response = $this->get('/api/documentation.json');
        $spec = $response->json();

        // Check security schemes
        $this->assertArrayHasKey('securitySchemes', $spec['components']);
        $this->assertArrayHasKey('sanctum', $spec['components']['securitySchemes']);

        $sanctumScheme = $spec['components']['securitySchemes']['sanctum'];
        $this->assertEquals('http', $sanctumScheme['type']);
        $this->assertEquals('bearer', $sanctumScheme['scheme']);
    }

    /**
     * Test that response schemas are defined
     */
    public function test_response_schemas_are_defined()
    {
        $response = $this->get('/api/documentation.json');
        $spec = $response->json();

        // Check that paths have response definitions
        foreach ($spec['paths'] as $path => $methods) {
            foreach ($methods as $method => $definition) {
                if (! is_array($definition)) {
                    continue;
                }

                $this->assertArrayHasKey('responses', $definition,
                    "No responses defined for $method $path");

                // Check for at least 200 response
                $this->assertArrayHasKey('200', $definition['responses'],
                    "No 200 response defined for $method $path");
            }
        }
    }
}
