<?php

namespace Tests\Performance;

use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\PerformanceMonitor;
use App\Services\Telegram\SessionManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class TelegramPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected PerformanceMonitor $performanceMonitor;

    protected ConcurrencyManager $concurrencyManager;

    protected SessionManager $sessionManager;

    protected function setUp(): void
    {
        parent::setUp();

        Redis::flushdb();

        $this->performanceMonitor = app(PerformanceMonitor::class);
        $this->concurrencyManager = app(ConcurrencyManager::class);
        $this->sessionManager = app(SessionManager::class);
    }

    /**
     * Test concurrent conversation handling performance
     */
    public function test_concurrent_conversation_performance()
    {
        $this->markTestSkipped('Performance test - run manually with --filter=test_concurrent_conversation_performance');

        $concurrentUsers = 50;
        $startTime = microtime(true);
        $memoryStart = memory_get_usage(true);

        // Register conversations concurrently
        for ($userId = 1; $userId <= $concurrentUsers; $userId++) {
            $result = $this->concurrencyManager->registerConversation($userId);
            $this->assertTrue($result, "Failed to register conversation for user {$userId}");
        }

        $registrationTime = microtime(true) - $startTime;

        // Performance assertions
        $this->assertLessThan(2.0, $registrationTime, 'Registration should complete in < 2 seconds');

        // Test conversation stats retrieval performance
        $statsStart = microtime(true);
        $stats = $this->concurrencyManager->getStats();
        $statsTime = (microtime(true) - $statsStart) * 1000;

        $this->assertLessThan(100, $statsTime, 'Stats retrieval should take < 100ms');
        $this->assertEquals($concurrentUsers, $stats['active_conversations']);

        // Cleanup and test cleanup performance
        $cleanupStart = microtime(true);
        $cleaned = $this->concurrencyManager->forceCleanup();
        $cleanupTime = (microtime(true) - $cleanupStart) * 1000;

        $this->assertEquals($concurrentUsers, $cleaned);
        $this->assertLessThan(500, $cleanupTime, 'Cleanup should take < 500ms');
    }

    /**
     * Test memory usage under sustained load
     */
    public function test_memory_usage_under_load()
    {
        $this->markTestSkipped('Performance test - run manually');

        $initialMemory = memory_get_usage(true);
        $maxAllowedIncrease = 30 * 1024 * 1024; // 30MB

        $userCount = 100;

        // Create sessions with realistic data
        for ($userId = 1; $userId <= $userCount; $userId++) {
            $session = $this->sessionManager->getSession($userId);

            // Add realistic session data
            $session->addStateData('conversation_history', [
                'messages' => array_fill(0, 10, 'Message content here with some length to simulate real usage'),
                'context' => ['location' => 'Test Location', 'preferences' => ['fuel_type' => 'magna']],
                'analytics' => ['queries' => rand(1, 20), 'last_query' => 'precio gasolina'],
            ]);

            $this->sessionManager->saveSession($session);
            $this->concurrencyManager->registerConversation($userId);
        }

        $currentMemory = memory_get_usage(true);
        $memoryIncrease = $currentMemory - $initialMemory;

        $this->assertLessThan($maxAllowedIncrease, $memoryIncrease,
            'Memory increase should be < 30MB for 100 users, actual: '.
            round($memoryIncrease / 1024 / 1024, 2).'MB');

        // Test memory efficiency of session compression
        if (config('telegram.session_compression', true)) {
            // Memory usage should be lower with compression
            $sessionMetrics = $this->sessionManager->getSessionMetrics();
            $avgSessionSize = $sessionMetrics['total_size_bytes'] / $sessionMetrics['total_sessions'];

            $this->assertLessThan(2048, $avgSessionSize, 'Average session size should be < 2KB with compression');
        }
    }

    /**
     * Test response time consistency under load
     */
    public function test_response_time_consistency()
    {
        $this->markTestSkipped('Performance test - run manually');

        $commandExecutions = 100;
        $responseTimes = [];

        for ($i = 1; $i <= $commandExecutions; $i++) {
            $timerId = $this->performanceMonitor->startTimer('precios', $i);

            // Simulate command execution with variable processing time
            $processingTime = rand(50000, 300000); // 50-300ms
            usleep($processingTime);

            $metrics = $this->performanceMonitor->endTimer($timerId);
            $responseTimes[] = $metrics['response_time_ms'];
        }

        // Calculate statistics
        $avgResponseTime = array_sum($responseTimes) / count($responseTimes);
        $maxResponseTime = max($responseTimes);
        $minResponseTime = min($responseTimes);

        sort($responseTimes);
        $p95ResponseTime = $responseTimes[intval($commandExecutions * 0.95)];
        $p99ResponseTime = $responseTimes[intval($commandExecutions * 0.99)];

        // Performance assertions
        $this->assertLessThan(1000, $avgResponseTime, 'Average response time should be < 1 second');
        $this->assertLessThan(3000, $p95ResponseTime, '95th percentile should be < 3 seconds');
        $this->assertLessThan(5000, $p99ResponseTime, '99th percentile should be < 5 seconds');
        $this->assertLessThan(10000, $maxResponseTime, 'Max response time should be < 10 seconds');

        // Check consistency (standard deviation)
        $variance = 0;
        foreach ($responseTimes as $time) {
            $variance += pow($time - $avgResponseTime, 2);
        }
        $stdDev = sqrt($variance / count($responseTimes));

        $this->assertLessThan($avgResponseTime * 0.5, $stdDev, 'Response times should be consistent (low std dev)');

        Log::info('Response time performance test results', [
            'executions' => $commandExecutions,
            'avg_response_time' => $avgResponseTime,
            'p95_response_time' => $p95ResponseTime,
            'p99_response_time' => $p99ResponseTime,
            'max_response_time' => $maxResponseTime,
            'min_response_time' => $minResponseTime,
            'std_deviation' => $stdDev,
        ]);
    }

    /**
     * Test monitoring data accuracy under load
     */
    public function test_monitoring_data_accuracy()
    {
        $commandTypes = ['precios', 'help', 'stats', 'analytics'];
        $executionsPerCommand = 25;

        $expectedTotals = [];

        // Execute multiple commands and track expectations
        foreach ($commandTypes as $command) {
            $expectedTotals[$command] = 0;

            for ($i = 1; $i <= $executionsPerCommand; $i++) {
                $timerId = $this->performanceMonitor->startTimer($command, $i);

                usleep(rand(25000, 100000)); // 25-100ms

                $this->performanceMonitor->endTimer($timerId);
                $expectedTotals[$command]++;
            }
        }

        // Verify monitoring data accuracy
        foreach ($commandTypes as $command) {
            $stats = $this->performanceMonitor->getCommandStats($command);

            $this->assertEquals($expectedTotals[$command], $stats['total_executions'],
                "Command {$command} execution count mismatch");

            $this->assertGreaterThan(0, $stats['avg_response_time_ms'],
                "Command {$command} should have recorded response times");

            $this->assertLessThan(200, $stats['avg_response_time_ms'],
                "Command {$command} average response time should be reasonable");
        }

        // Test dashboard data compilation
        $dashboardData = $this->performanceMonitor->getDashboardData();

        $this->assertArrayHasKey('commands', $dashboardData);
        $this->assertArrayHasKey('system', $dashboardData);
        $this->assertArrayHasKey('generated_at', $dashboardData);

        foreach ($commandTypes as $command) {
            $this->assertArrayHasKey($command, $dashboardData['commands']);
        }
    }

    /**
     * Test admin command performance
     */
    public function test_admin_command_performance()
    {
        // Set test user as admin
        config(['telegram.admin_chat_ids' => [999]]);

        $adminCommands = [
            '/api/telegram/health',
            '/api/telegram/status',
            '/api/telegram/circuits',
        ];

        foreach ($adminCommands as $endpoint) {
            $start = microtime(true);
            $response = $this->getJson($endpoint);
            $responseTime = (microtime(true) - $start) * 1000;

            $this->assertEquals(200, $response->getStatusCode());
            $this->assertLessThan(1000, $responseTime,
                "Admin endpoint {$endpoint} should respond in < 1 second, took {$responseTime}ms");

            // Verify response structure
            $data = $response->json();
            $this->assertIsArray($data);
            $this->assertArrayHasKey('timestamp', $data);
        }
    }

    /**
     * Benchmark session operations
     */
    public function test_session_operation_benchmarks()
    {
        $operationCounts = 1000;
        $userIds = range(1, 100);

        // Benchmark session creation
        $start = microtime(true);
        foreach ($userIds as $userId) {
            $session = $this->sessionManager->getSession($userId);
            $session->addStateData('benchmark_data', str_repeat('x', 500));
            $this->sessionManager->saveSession($session);
        }
        $creationTime = (microtime(true) - $start) * 1000;

        $this->assertLessThan(2000, $creationTime, 'Session creation should take < 2 seconds for 100 users');

        // Benchmark session retrieval
        $start = microtime(true);
        $batchSessions = $this->sessionManager->getBatchSessions($userIds);
        $retrievalTime = (microtime(true) - $start) * 1000;

        $this->assertCount(100, $batchSessions);
        $this->assertLessThan(500, $retrievalTime, 'Batch session retrieval should take < 500ms');

        // Benchmark session cleanup
        $start = microtime(true);
        $cleaned = $this->sessionManager->cleanupExpiredSessions();
        $cleanupTime = (microtime(true) - $start) * 1000;

        $this->assertLessThan(1000, $cleanupTime, 'Session cleanup should take < 1 second');

        Log::info('Session operation benchmarks', [
            'creation_time_ms' => $creationTime,
            'retrieval_time_ms' => $retrievalTime,
            'cleanup_time_ms' => $cleanupTime,
            'sessions_tested' => count($userIds),
        ]);
    }

    protected function tearDown(): void
    {
        Redis::flushdb();
        parent::tearDown();
    }
}
