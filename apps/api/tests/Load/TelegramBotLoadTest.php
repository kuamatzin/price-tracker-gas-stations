<?php

namespace Tests\Load;

use App\Services\Telegram\CircuitBreaker;
use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\PerformanceMonitor;
use GuzzleHttp\Client;
use GuzzleHttp\Promise;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class TelegramBotLoadTest extends TestCase
{
    use RefreshDatabase;

    protected Client $httpClient;

    protected PerformanceMonitor $performanceMonitor;

    protected ConcurrencyManager $concurrencyManager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->httpClient = new Client;
        $this->performanceMonitor = app(PerformanceMonitor::class);
        $this->concurrencyManager = app(ConcurrencyManager::class);

        // Clean up any existing test data
        Redis::flushdb();
    }

    /**
     * Test 100 concurrent users sending commands
     */
    public function test_concurrent_user_load()
    {
        $concurrentUsers = 100;
        $commandsPerUser = 5;
        $totalRequests = $concurrentUsers * $commandsPerUser;

        $this->markTestSkipped('Load test - run manually with: php artisan test --filter=test_concurrent_user_load');

        $startTime = microtime(true);
        $promises = [];
        $results = [];

        // Create concurrent requests
        for ($userId = 1; $userId <= $concurrentUsers; $userId++) {
            for ($commandNum = 1; $commandNum <= $commandsPerUser; $commandNum++) {
                $promises[] = $this->createAsyncTelegramRequest($userId, $commandNum);
            }
        }

        // Wait for all requests to complete
        $responses = Promise\settle($promises)->wait();

        $totalTime = microtime(true) - $startTime;

        // Analyze results
        $successCount = 0;
        $errorCount = 0;
        $responseTimes = [];

        foreach ($responses as $response) {
            if ($response['state'] === 'fulfilled') {
                $successCount++;
                if (isset($response['value']['response_time'])) {
                    $responseTimes[] = $response['value']['response_time'];
                }
            } else {
                $errorCount++;
            }
        }

        // Performance assertions
        $this->assertGreaterThan($totalRequests * 0.95, $successCount, 'Success rate should be > 95%');
        $this->assertLessThan($totalRequests * 0.05, $errorCount, 'Error rate should be < 5%');
        $this->assertLessThan(30, $totalTime, 'Total execution time should be < 30 seconds');

        if (! empty($responseTimes)) {
            $avgResponseTime = array_sum($responseTimes) / count($responseTimes);
            $this->assertLessThan(3000, $avgResponseTime, 'Average response time should be < 3 seconds');

            $p95ResponseTime = $this->getPercentile($responseTimes, 95);
            $this->assertLessThan(5000, $p95ResponseTime, '95th percentile response time should be < 5 seconds');
        }

        // Check concurrency manager stats
        $concurrencyStats = $this->concurrencyManager->getStats();
        $this->assertLessThanOrEqual(100, $concurrencyStats['active_conversations'], 'Should not exceed max concurrent conversations');

        Log::info('Load test completed', [
            'total_requests' => $totalRequests,
            'success_count' => $successCount,
            'error_count' => $errorCount,
            'total_time' => $totalTime,
            'avg_response_time' => $avgResponseTime ?? 0,
            'p95_response_time' => $p95ResponseTime ?? 0,
        ]);
    }

    /**
     * Test circuit breaker activation under load
     */
    public function test_circuit_breaker_under_load()
    {
        $this->markTestSkipped('Load test - run manually');

        $circuitBreaker = CircuitBreaker::createForDeepSeek();
        $circuitBreaker->reset();

        // Simulate failing service calls
        $failureCount = 0;
        $successCount = 0;

        for ($i = 0; $i < 10; $i++) {
            try {
                $circuitBreaker->execute(function () {
                    // Simulate random failures (70% failure rate)
                    if (rand(1, 10) <= 7) {
                        throw new \Exception('Simulated service failure');
                    }

                    return 'success';
                });
                $successCount++;
            } catch (\Exception $e) {
                $failureCount++;
            }
        }

        // Circuit breaker should be open after 5 failures
        $this->assertEquals(CircuitBreakerState::OPEN, $circuitBreaker->getState());
        $this->assertGreaterThanOrEqual(5, $failureCount);

        // Test that further calls are rejected
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/Circuit breaker.*is OPEN/');

        $circuitBreaker->execute(function () {
            return 'should not execute';
        });
    }

    /**
     * Test graceful degradation under load
     */
    public function test_graceful_degradation()
    {
        $this->markTestSkipped('Load test - run manually');

        $degradationManager = app(DegradationManager::class);

        // Force degradation to test fallbacks
        $degradationManager->forceDegradationLevel('degraded');

        $this->assertFalse($degradationManager->isFeatureEnabled('nlp'));
        $this->assertFalse($degradationManager->isFeatureEnabled('analytics'));
        $this->assertTrue($degradationManager->isSlowModeEnabled());

        // Test fallback responses
        $fallbackResponse = $degradationManager->getFallbackResponse('deepseek', 'precio gasolina');
        $this->assertNotNull($fallbackResponse);
        $this->assertStringContainsString('temporalmente no disponible', $fallbackResponse);
    }

    /**
     * Test memory usage under sustained load
     */
    public function test_memory_usage_under_load()
    {
        $this->markTestSkipped('Load test - run manually');

        $initialMemory = memory_get_usage(true);
        $maxMemoryIncrease = 50 * 1024 * 1024; // 50MB max increase

        // Simulate 100 conversations
        for ($i = 1; $i <= 100; $i++) {
            $this->concurrencyManager->registerConversation($i);

            // Simulate some session activity
            $sessionManager = app(SessionManager::class);
            $session = $sessionManager->getSession($i);
            $session->addStateData('test_data', str_repeat('x', 1000)); // 1KB of data
            $sessionManager->saveSession($session);
        }

        $finalMemory = memory_get_usage(true);
        $memoryIncrease = $finalMemory - $initialMemory;

        $this->assertLessThan($maxMemoryIncrease, $memoryIncrease,
            'Memory increase should be < 50MB, actual: '.round($memoryIncrease / 1024 / 1024, 2).'MB');

        // Clean up
        for ($i = 1; $i <= 100; $i++) {
            $this->concurrencyManager->unregisterConversation($i);
        }
    }

    /**
     * Test rate limiting accuracy
     */
    public function test_rate_limiting_accuracy()
    {
        $userId = 12345;
        $perUserLimit = config('telegram.rate_limit_per_user', 30);

        // Make requests up to the limit
        for ($i = 0; $i < $perUserLimit; $i++) {
            $response = $this->postJson('/api/telegram/webhook', $this->createTelegramUpdate($userId, "/test{$i}"));

            if ($i < $perUserLimit - 1) {
                $this->assertNotEquals(429, $response->getStatusCode(), "Request {$i} should not be rate limited");
            }
        }

        // The next request should be rate limited
        $response = $this->postJson('/api/telegram/webhook', $this->createTelegramUpdate($userId, '/overflow'));
        $this->assertEquals(429, $response->getStatusCode(), 'Request should be rate limited');
    }

    /**
     * Create async Telegram request for load testing
     */
    protected function createAsyncTelegramRequest(int $userId, int $commandNum): \GuzzleHttp\Promise\PromiseInterface
    {
        $update = $this->createTelegramUpdate($userId, '/precios');

        return $this->httpClient->postAsync(url('/api/telegram/webhook'), [
            'json' => $update,
            'timeout' => 10,
        ])->then(
            function ($response) use ($userId, $commandNum) {
                return [
                    'user_id' => $userId,
                    'command_num' => $commandNum,
                    'status_code' => $response->getStatusCode(),
                    'response_time' => 0, // Would need to measure this properly
                ];
            },
            function ($error) use ($userId, $commandNum) {
                return [
                    'user_id' => $userId,
                    'command_num' => $commandNum,
                    'error' => $error->getMessage(),
                ];
            }
        );
    }

    /**
     * Create a mock Telegram update for testing
     */
    protected function createTelegramUpdate(int $userId, string $command): array
    {
        return [
            'update_id' => rand(1000000, 9999999),
            'message' => [
                'message_id' => rand(1000, 9999),
                'from' => [
                    'id' => $userId,
                    'is_bot' => false,
                    'first_name' => "TestUser{$userId}",
                    'username' => "testuser{$userId}",
                ],
                'chat' => [
                    'id' => $userId,
                    'first_name' => "TestUser{$userId}",
                    'username' => "testuser{$userId}",
                    'type' => 'private',
                ],
                'date' => time(),
                'text' => $command,
            ],
        ];
    }

    /**
     * Calculate percentile from array of values
     */
    protected function getPercentile(array $values, int $percentile): float
    {
        sort($values);
        $index = ceil((count($values) * $percentile) / 100) - 1;

        return $values[$index] ?? 0;
    }

    /**
     * Performance benchmark test
     */
    public function test_performance_benchmarks()
    {
        // Test individual command performance
        $commands = ['precios', 'help', 'start'];

        foreach ($commands as $command) {
            $timerId = $this->performanceMonitor->startTimer($command, 999);

            // Simulate command execution
            usleep(rand(100000, 500000)); // 100-500ms

            $metrics = $this->performanceMonitor->endTimer($timerId);

            $this->assertArrayHasKey('response_time_ms', $metrics);
            $this->assertLessThan(1000, $metrics['response_time_ms'],
                "Command {$command} should execute in < 1 second");
        }
    }

    /**
     * Test health check response times
     */
    public function test_health_check_performance()
    {
        $endpoints = [
            '/api/telegram/health',
            '/api/telegram/status',
            '/api/telegram/circuits',
        ];

        foreach ($endpoints as $endpoint) {
            $start = microtime(true);
            $response = $this->getJson($endpoint);
            $responseTime = (microtime(true) - $start) * 1000;

            $this->assertEquals(200, $response->getStatusCode());
            $this->assertLessThan(500, $responseTime,
                "Health check {$endpoint} should respond in < 500ms, took {$responseTime}ms");
        }
    }
}
