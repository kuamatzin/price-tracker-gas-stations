<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Redis;

class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushall();
    }

    /**
     * Test that rate limit headers are present on all responses
     */
    public function test_rate_limit_headers_are_present()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->get('/api/v1/prices/current');

        $response->assertHeader('X-RateLimit-Limit');
        $response->assertHeader('X-RateLimit-Remaining');
        $response->assertHeader('X-RateLimit-Reset');
        $response->assertHeader('X-RateLimit-Tier');
        $response->assertHeader('X-RateLimit-Usage');
    }

    /**
     * Test that rate limits are enforced per tier
     */
    public function test_rate_limits_are_enforced_per_tier()
    {
        $tiers = [
            'free' => 100,
            'basic' => 500,
            'premium' => 1000,
            'enterprise' => 10000,
        ];

        foreach ($tiers as $tier => $limit) {
            Redis::flushall();
            
            $user = User::factory()->create(['subscription_tier' => $tier]);
            Sanctum::actingAs($user);

            $response = $this->get('/api/v1/prices/current');
            
            $response->assertHeader('X-RateLimit-Limit', $limit);
            $response->assertHeader('X-RateLimit-Tier', $tier);
        }
    }

    /**
     * Test that rate limit decrements correctly
     */
    public function test_rate_limit_decrements_correctly()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // First request
        $response1 = $this->get('/api/v1/prices/current');
        $remaining1 = (int) $response1->headers->get('X-RateLimit-Remaining');

        // Simulate usage increment
        $key = 'rate_limit:' . $user->id . ':' . now()->format('Y-m-d-H');
        Redis::incr($key);

        // Second request
        $response2 = $this->get('/api/v1/prices/current');
        $remaining2 = (int) $response2->headers->get('X-RateLimit-Remaining');

        $this->assertLessThan($remaining1, $remaining2);
    }

    /**
     * Test that Retry-After header is set when rate limit exceeded
     */
    public function test_retry_after_header_when_rate_limit_exceeded()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // Simulate rate limit exceeded
        $key = 'rate_limit:' . $user->id . ':' . now()->format('Y-m-d-H');
        Redis::set($key, 100); // Max for free tier

        $response = $this->get('/api/v1/prices/current');

        $response->assertHeader('X-RateLimit-Remaining', 0);
        $response->assertHeader('Retry-After');
    }

    /**
     * Test that rate limit resets after the hour
     */
    public function test_rate_limit_resets_after_hour()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // Set high usage for current hour
        $currentKey = 'rate_limit:' . $user->id . ':' . now()->format('Y-m-d-H');
        Redis::set($currentKey, 99);

        $response1 = $this->get('/api/v1/prices/current');
        $remaining1 = (int) $response1->headers->get('X-RateLimit-Remaining');
        $this->assertEquals(1, $remaining1);

        // Simulate next hour
        $this->travel(1)->hours();
        Redis::del($currentKey); // Clear old hour's data

        $response2 = $this->get('/api/v1/prices/current');
        $remaining2 = (int) $response2->headers->get('X-RateLimit-Remaining');
        $this->assertEquals(100, $remaining2);
    }

    /**
     * Test that usage percentage is calculated correctly
     */
    public function test_usage_percentage_is_calculated_correctly()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        // Set 50% usage
        $key = 'rate_limit:' . $user->id . ':' . now()->format('Y-m-d-H');
        Redis::set($key, 50);

        $response = $this->get('/api/v1/prices/current');
        
        $usage = $response->headers->get('X-RateLimit-Usage');
        $this->assertEquals('50%', $usage);
    }

    /**
     * Test that rate limiting works for different endpoints
     */
    public function test_rate_limiting_works_for_different_endpoints()
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $endpoints = [
            '/api/v1/prices/current',
            '/api/v1/trends/market',
            '/api/v1/competitors',
            '/api/v1/geo/estados',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->get($endpoint);
            
            $response->assertHeader('X-RateLimit-Limit');
            $response->assertHeader('X-RateLimit-Remaining');
        }
    }

    /**
     * Test that public endpoints don't have rate limit headers
     */
    public function test_public_endpoints_dont_have_rate_limit_headers()
    {
        $response = $this->get('/api/health');

        $response->assertHeaderMissing('X-RateLimit-Limit');
        $response->assertHeaderMissing('X-RateLimit-Remaining');
    }
}