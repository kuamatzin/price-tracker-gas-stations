<?php

namespace Tests\Unit\Services\External;

use Tests\TestCase;
use App\Services\External\DeepSeekService;
use App\Exceptions\ExternalServiceException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;

class DeepSeekServiceTest extends TestCase
{
    protected DeepSeekService $service;

    protected function setUp(): void
    {
        parent::setUp();
        
        Config::set('deepseek.api_key', 'test-key');
        Config::set('deepseek.api_url', 'https://api.deepseek.com/v1');
        Config::set('deepseek.model', 'deepseek-chat');
        Config::set('deepseek.max_tokens', 500);
        Config::set('deepseek.temperature', 0.7);
        Config::set('deepseek.timeout_seconds', 2);
        
        $this->service = new DeepSeekService();
    }

    public function test_analyze_caches_results()
    {
        $query = 'precio de gasolina';
        $expectedResponse = [
            'intent' => 'price_query',
            'entities' => ['fuel_type' => 'regular'],
            'confidence' => 0.85
        ];
        
        Http::fake([
            'api.deepseek.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => json_encode($expectedResponse)]]
                ]
            ], 200)
        ]);
        
        // First call - should hit API
        $result1 = $this->service->analyze($query);
        
        // Second call - should use cache
        Cache::shouldReceive('remember')
            ->once()
            ->andReturn(array_merge($expectedResponse, [
                'response_time_ms' => 100,
                'attempt' => 1
            ]));
        
        $result2 = $this->service->analyze($query);
        
        $this->assertEquals($result1['intent'], $result2['intent']);
    }

    public function test_analyze_retries_on_connection_failure()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::sequence()
                ->pushStatus(500) // First attempt fails
                ->push([
                    'choices' => [
                        ['message' => ['content' => json_encode([
                            'intent' => 'price_query',
                            'confidence' => 0.9
                        ])]]
                    ]
                ], 200) // Second attempt succeeds
        ]);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        $result = $this->service->analyze('test query');
        
        $this->assertEquals('price_query', $result['intent']);
        $this->assertEquals(2, $result['attempt']);
    }

    public function test_analyze_throws_after_max_retries()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::sequence()
                ->pushStatus(500)
                ->pushStatus(500)
                ->pushStatus(500)
        ]);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        $this->expectException(ExternalServiceException::class);
        $this->expectExceptionMessage('DeepSeek API unavailable after 3 attempts');
        
        $this->service->analyze('test query');
    }

    public function test_analyze_handles_invalid_json_response()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => 'invalid json']]
                ]
            ], 200)
        ]);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        $this->expectException(ExternalServiceException::class);
        $this->expectExceptionMessage('Invalid JSON in DeepSeek response');
        
        $this->service->analyze('test query');
    }

    public function test_analyze_handles_missing_response_fields()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::response([
                'invalid' => 'response'
            ], 200)
        ]);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        $this->expectException(ExternalServiceException::class);
        $this->expectExceptionMessage('Invalid DeepSeek response structure');
        
        $this->service->analyze('test query');
    }

    public function test_is_available_returns_true_when_api_accessible()
    {
        Http::fake([
            'api.deepseek.com/v1/models' => Http::response(['models' => []], 200)
        ]);
        
        $this->assertTrue($this->service->isAvailable());
    }

    public function test_is_available_returns_false_when_api_down()
    {
        Http::fake([
            'api.deepseek.com/v1/models' => Http::response(null, 500)
        ]);
        
        $this->assertFalse($this->service->isAvailable());
    }

    public function test_is_available_returns_false_on_timeout()
    {
        Http::fake([
            'api.deepseek.com/v1/models' => function () {
                sleep(3); // Longer than 2 second timeout
                return Http::response(['models' => []], 200);
            }
        ]);
        
        $this->assertFalse($this->service->isAvailable());
    }

    public function test_builds_correct_system_prompt_with_context()
    {
        $context = [
            'last_intent' => 'price_query',
            'fuel_type' => 'premium'
        ];
        
        Http::fake([
            'api.deepseek.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => json_encode([
                        'intent' => 'price_query',
                        'confidence' => 0.95
                    ])]]
                ]
            ], 200)
        ]);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        Http::assertSentCount(0);
        
        $this->service->analyze('¿y la diesel?', $context);
        
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);
            $systemPrompt = $body['messages'][0]['content'];
            
            return str_contains($systemPrompt, 'Contexto de la conversación');
        });
    }
    
    public function test_circuit_breaker_opens_after_threshold_failures()
    {
        // Reset static circuit breaker state
        $reflection = new \ReflectionClass($this->service);
        $failureCount = $reflection->getProperty('failureCount');
        $failureCount->setAccessible(true);
        $failureCount->setValue(null, 0);
        
        Http::fake([
            'api.deepseek.com/*' => Http::response('Server Error', 500)
        ]);
        
        Cache::shouldReceive('remember')
            ->andReturnUsing(function ($key, $ttl, $callback) {
                return $callback();
            });
        
        // Make 5 failed requests (threshold)
        for ($i = 0; $i < 5; $i++) {
            try {
                $this->service->analyze('test');
            } catch (\Exception $e) {
                // Expected failure
            }
        }
        
        // Circuit should now be open
        $this->expectException(ExternalServiceException::class);
        $this->expectExceptionMessage('circuit breaker is open');
        
        $this->service->analyze('test');
    }
    
    public function test_is_available_returns_false_when_circuit_open()
    {
        // Set circuit breaker to open state
        $reflection = new \ReflectionClass($this->service);
        $failureCount = $reflection->getProperty('failureCount');
        $failureCount->setAccessible(true);
        $failureCount->setValue(null, 5); // Set to threshold
        
        // Should return false without making HTTP request
        $this->assertFalse($this->service->isAvailable());
        
        // Verify no HTTP request was made
        Http::assertNothingSent();
    }
}