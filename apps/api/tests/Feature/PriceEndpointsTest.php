<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PriceEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_current_prices_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/prices/current');
        $response->assertStatus(401);
    }

    public function test_nearby_prices_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/prices/nearby?lat=19.4326&lng=-99.1332');
        $response->assertStatus(401);
    }

    public function test_station_prices_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/prices/station/12345');
        $response->assertStatus(401);
    }

    public function test_current_prices_endpoint_structure(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/current');

        // Should return 200 or 422 (if no data), but not 500
        $this->assertContains($response->status(), [200, 422]);

        if ($response->status() === 200) {
            $response->assertJsonStructure([
                'success',
                'message',
                'data',
            ]);
        }
    }

    public function test_nearby_prices_validates_coordinates(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        // Test missing lat/lng
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/nearby');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lat', 'lng']);
    }

    public function test_nearby_prices_validates_coordinate_ranges(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        // Test invalid lat/lng ranges
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/nearby?lat=91&lng=181');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lat', 'lng']);
    }

    public function test_current_prices_accepts_filters(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/current?brand=Pemex&page_size=25');

        // Should not error on valid filters
        $this->assertNotEquals(500, $response->status());
    }

    public function test_nearby_prices_accepts_radius(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/nearby?lat=19.4326&lng=-99.1332&radius=10');

        // Should not error on valid radius
        $this->assertNotEquals(500, $response->status());
    }

    public function test_station_endpoint_handles_nonexistent_station(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/prices/station/nonexistent');

        // Should return 404 for non-existent station
        $this->assertEquals(404, $response->status());
    }
}
