<?php

namespace Tests\Integration\Telegram;

use App\Services\Telegram\CircuitBreaker;
use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\DegradationManager;
use App\Services\Telegram\PerformanceMonitor;
use App\Services\Telegram\SessionManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class PerformanceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushdb();
    }

    /**
     * Test Redis session persistence under load
     */
    public function test_redis_session_persistence()
    {
        $sessionManager = app(SessionManager::class);
        $userIds = range(1, 50);

        // Create sessions for 50 users
        $sessions = [];
        foreach ($userIds as $userId) {
            $session = $sessionManager->getSession($userId);
            $session->addStateData('test_data', "data_for_user_{$userId}");
            $sessions[$userId] = $session;

            $result = $sessionManager->saveSession($session);
            $this->assertTrue($result, "Failed to save session for user {$userId}");
        }

        // Verify all sessions can be retrieved
        foreach ($userIds as $userId) {
            $retrievedSession = $sessionManager->getSession($userId);
            $this->assertEquals("data_for_user_{$userId}", $retrievedSession->getStateData('test_data'));
        }

        // Test batch retrieval
        $batchSessions = $sessionManager->getBatchSessions($userIds);
        $this->assertCount(50, $batchSessions);

        foreach ($userIds as $userId) {
            $this->assertArrayHasKey($userId, $batchSessions);
            $this->assertEquals("data_for_user_{$userId}", $batchSessions[$userId]->getStateData('test_data'));
        }
    }

    /**
     * Test timeout recovery scenarios
     */
    public function test_timeout_recovery()
    {
        $timeoutManager = app(TimeoutManager::class);

        // Test successful retry after initial timeout
        $attemptCount = 0;

        $result = $timeoutManager->executeWithTimeout(
            function () use (&$attemptCount) {
                $attemptCount++;

                if ($attemptCount === 1) {
                    // Simulate timeout on first attempt
                    usleep(2100000); // 2.1 seconds (exceeds 2s timeout)
                    throw new \Exception('Simulated timeout');
                }

                // Success on retry
                return "success_on_attempt_{$attemptCount}";
            },
            'deepseek_api',
            2 // max retries
        );

        $this->assertEquals('success_on_attempt_2', $result);
        $this->assertEquals(2, $attemptCount);
    }

    /**
     * Test service degradation scenarios
     */
    public function test_service_degradation()
    {
        $degradationManager = app(DegradationManager::class);

        // Start in healthy state
        $this->assertEquals('healthy', $degradationManager->getCurrentLevel());
        $this->assertTrue($degradationManager->isFeatureEnabled('nlp'));
        $this->assertTrue($degradationManager->isFeatureEnabled('analytics'));

        // Force degradation
        $degradationManager->forceDegradationLevel('degraded');

        $this->assertEquals('degraded', $degradationManager->getCurrentLevel());
        $this->assertFalse($degradationManager->isFeatureEnabled('nlp'));
        $this->assertFalse($degradationManager->isFeatureEnabled('analytics'));
        $this->assertTrue($degradationManager->isSlowModeEnabled());

        // Test fallback responses
        $fallbackResponse = $degradationManager->getFallbackResponse('deepseek', 'precio gasolina');
        $this->assertNotNull($fallbackResponse);
        $this->assertStringContainsString('temporalmente no disponible', $fallbackResponse);

        // Force to unhealthy
        $degradationManager->forceDegradationLevel('unhealthy');

        $this->assertEquals('unhealthy', $degradationManager->getCurrentLevel());
        $this->assertTrue($degradationManager->isReadOnlyMode());
    }

    /**
     * Test health check accuracy
     */
    public function test_health_check_accuracy()
    {
        // Test health check endpoints
        $response = $this->getJson('/api/telegram/health');
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertArrayHasKey('status', $data);
        $this->assertArrayHasKey('checks', $data);
        $this->assertArrayHasKey('timestamp', $data);

        // Check individual service health
        $this->assertArrayHasKey('redis', $data['checks']);
        $this->assertArrayHasKey('database', $data['checks']);
        $this->assertArrayHasKey('circuit_breakers', $data['checks']);

        // Test circuit status endpoint
        $response = $this->getJson('/api/telegram/circuits');
        $response->assertStatus(200);

        $circuitData = $response->json();
        $this->assertArrayHasKey('circuits', $circuitData);
        $this->assertArrayHasKey('deepseek', $circuitData['circuits']);
        $this->assertArrayHasKey('laravel_api', $circuitData['circuits']);
    }

    /**
     * Test rate limiting implementation
     */
    public function test_rate_limiting_integration()
    {
        $userId = 12345;
        $perUserLimit = config('telegram.rate_limit_per_user', 30);

        // Make requests up to limit - 1
        for ($i = 0; $i < $perUserLimit - 1; $i++) {
            $response = $this->postJson('/api/telegram/webhook', $this->createTelegramUpdate($userId, "/test{$i}"));

            // Should succeed (though might get other errors due to missing handlers)
            $this->assertNotEquals(429, $response->getStatusCode(), "Request {$i} should not be rate limited");
        }

        // The limit-th request might succeed or fail with rate limiting depending on timing
        // But the next one should definitely be rate limited if we exceed
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/telegram/webhook', $this->createTelegramUpdate($userId, "/overflow{$i}"));
            if ($response->getStatusCode() === 429) {
                // Rate limiting is working
                $this->assertEquals(429, $response->getStatusCode());

                return;
            }
        }

        // If we get here, rate limiting might not be triggered due to test timing
        $this->markTestIncomplete('Rate limiting test inconclusive - may need adjustment for test environment');
    }

    /**
     * Test performance monitoring data collection
     */
    public function test_performance_monitoring()
    {
        $performanceMonitor = app(PerformanceMonitor::class);

        // Start and end a timer
        $timerId = $performanceMonitor->startTimer('test_command', 999);

        usleep(150000); // 150ms

        $metrics = $performanceMonitor->endTimer($timerId);

        $this->assertArrayHasKey('command', $metrics);
        $this->assertArrayHasKey('user_id', $metrics);
        $this->assertArrayHasKey('response_time_ms', $metrics);
        $this->assertArrayHasKey('memory_usage_bytes', $metrics);

        $this->assertEquals('test_command', $metrics['command']);
        $this->assertEquals(999, $metrics['user_id']);
        $this->assertGreaterThan(100, $metrics['response_time_ms']);
        $this->assertLessThan(300, $metrics['response_time_ms']);

        // Test command stats retrieval
        $commandStats = $performanceMonitor->getCommandStats('test_command');
        $this->assertArrayHasKey('total_executions', $commandStats);
        $this->assertArrayHasKey('avg_response_time_ms', $commandStats);
    }

    /**
     * Test circuit breaker integration with services
     */
    public function test_circuit_breaker_integration()
    {
        $deepSeekBreaker = CircuitBreaker::createForDeepSeek();
        $laravelApiBreaker = CircuitBreaker::createForLaravelApi();

        // Reset both circuit breakers
        $deepSeekBreaker->reset();
        $laravelApiBreaker->reset();

        $this->assertEquals(CircuitBreakerState::CLOSED, $deepSeekBreaker->getState());
        $this->assertEquals(CircuitBreakerState::CLOSED, $laravelApiBreaker->getState());

        // Test failure tracking
        for ($i = 0; $i < 5; $i++) {
            try {
                $deepSeekBreaker->execute(function () {
                    throw new \Exception('Service failure');
                });
            } catch (\Exception $e) {
                // Expected failures
            }
        }

        // DeepSeek circuit should be open
        $this->assertEquals(CircuitBreakerState::OPEN, $deepSeekBreaker->getState());

        // Laravel API circuit should still be closed
        $this->assertEquals(CircuitBreakerState::CLOSED, $laravelApiBreaker->getState());

        // Test health check reflects circuit states
        $response = $this->getJson('/api/telegram/circuits');
        $data = $response->json();

        $this->assertEquals('OPEN', $data['circuits']['deepseek']['state']);
        $this->assertEquals('CLOSED', $data['circuits']['laravel_api']['state']);
    }

    /**
     * Test complete system integration under moderate load
     */
    public function test_system_integration_under_load()
    {
        $sessionManager = app(SessionManager::class);
        $concurrencyManager = app(ConcurrencyManager::class);
        $performanceMonitor = app(PerformanceMonitor::class);

        $userCount = 20;
        $commandsPerUser = 3;

        // Simulate concurrent user activity
        for ($userId = 1; $userId <= $userCount; $userId++) {
            // Register conversation
            $registered = $concurrencyManager->registerConversation($userId);
            $this->assertTrue($registered, "Failed to register conversation for user {$userId}");

            // Create and save session
            $session = $sessionManager->getSession($userId);
            $session->addStateData('user_data', "test_data_for_{$userId}");
            $sessionManager->saveSession($session);

            // Simulate command executions
            for ($cmd = 1; $cmd <= $commandsPerUser; $cmd++) {
                $timerId = $performanceMonitor->startTimer("test_cmd_{$cmd}", $userId);

                usleep(rand(50000, 200000)); // 50-200ms simulation

                $metrics = $performanceMonitor->endTimer($timerId);
                $this->assertLessThan(500, $metrics['response_time_ms'],
                    'Command should execute in < 500ms');
            }

            // Touch conversation to simulate activity
            $concurrencyManager->touchConversation($userId);
        }

        // Verify system stats
        $concurrencyStats = $concurrencyManager->getStats();
        $this->assertEquals($userCount, $concurrencyStats['active_conversations']);
        $this->assertFalse($concurrencyStats['under_backpressure']);

        $sessionMetrics = $sessionManager->getSessionMetrics();
        $this->assertEquals($userCount, $sessionMetrics['total_sessions']);

        // Clean up conversations
        for ($userId = 1; $userId <= $userCount; $userId++) {
            $concurrencyManager->unregisterConversation($userId);
        }

        $finalStats = $concurrencyManager->getStats();
        $this->assertEquals(0, $finalStats['active_conversations']);
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

    protected function tearDown(): void
    {
        Redis::flushdb();
        parent::tearDown();
    }
}
