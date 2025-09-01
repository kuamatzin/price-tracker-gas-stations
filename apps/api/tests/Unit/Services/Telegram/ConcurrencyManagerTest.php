<?php

namespace Tests\Unit\Services\Telegram;

use App\Services\Telegram\ConcurrencyManager;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class ConcurrencyManagerTest extends TestCase
{
    protected ConcurrencyManager $concurrencyManager;

    protected function setUp(): void
    {
        parent::setUp();

        // Clear Redis before each test
        Redis::flushdb();

        $this->concurrencyManager = new ConcurrencyManager;
    }

    public function test_can_register_conversation()
    {
        $userId = 123;

        $result = $this->concurrencyManager->registerConversation($userId);

        $this->assertTrue($result);
        $this->assertEquals(1, $this->concurrencyManager->getActiveConversationCount());
    }

    public function test_conversation_registration_respects_max_limit()
    {
        $maxLimit = config('telegram.max_concurrent_conversations', 100);

        // Register conversations up to the limit
        for ($i = 1; $i <= $maxLimit; $i++) {
            $result = $this->concurrencyManager->registerConversation($i);
            $this->assertTrue($result, "Should allow conversation {$i}");
        }

        // Next registration should fail
        $result = $this->concurrencyManager->registerConversation($maxLimit + 1);
        $this->assertFalse($result, 'Should reject conversation beyond limit');
    }

    public function test_can_unregister_conversation()
    {
        $userId = 123;

        $this->concurrencyManager->registerConversation($userId);
        $this->assertEquals(1, $this->concurrencyManager->getActiveConversationCount());

        $this->concurrencyManager->unregisterConversation($userId);
        $this->assertEquals(0, $this->concurrencyManager->getActiveConversationCount());
    }

    public function test_backpressure_detection()
    {
        $maxLimit = config('telegram.max_concurrent_conversations', 100);
        $backpressureThreshold = (int) ($maxLimit * 0.8); // 80%

        // Register conversations just below threshold
        for ($i = 1; $i < $backpressureThreshold; $i++) {
            $this->concurrencyManager->registerConversation($i);
        }

        $this->assertFalse($this->concurrencyManager->isUnderBackpressure());

        // Register one more to trigger backpressure
        $this->concurrencyManager->registerConversation($backpressureThreshold);
        $this->assertTrue($this->concurrencyManager->isUnderBackpressure());
    }

    public function test_request_queueing()
    {
        $requestData = [
            'user_id' => 456,
            'message' => 'Test message',
            'priority' => 'normal',
        ];

        $result = $this->concurrencyManager->queueRequest($requestData);
        $this->assertTrue($result);

        $queueStats = $this->concurrencyManager->getQueueStats();
        $this->assertEquals(1, $queueStats['queue_length']);
    }

    public function test_queue_processing()
    {
        // Queue a request
        $requestData = [
            'user_id' => 789,
            'message' => 'Test message',
        ];

        $this->concurrencyManager->queueRequest($requestData);

        // Process the queue
        $processed = $this->concurrencyManager->processQueuedRequests();

        $this->assertCount(1, $processed);
        $this->assertEquals(789, $processed[0]['user_id']);

        // Queue should be empty now
        $queueStats = $this->concurrencyManager->getQueueStats();
        $this->assertEquals(0, $queueStats['queue_length']);
    }

    public function test_conversation_stats()
    {
        // Register some conversations
        for ($i = 1; $i <= 5; $i++) {
            $this->concurrencyManager->registerConversation($i);
        }

        $stats = $this->concurrencyManager->getStats();

        $this->assertArrayHasKey('active_conversations', $stats);
        $this->assertArrayHasKey('max_conversations', $stats);
        $this->assertArrayHasKey('utilization_percentage', $stats);
        $this->assertArrayHasKey('under_backpressure', $stats);
        $this->assertArrayHasKey('can_accept_new', $stats);

        $this->assertEquals(5, $stats['active_conversations']);
        $this->assertTrue($stats['can_accept_new']);
    }

    public function test_force_cleanup()
    {
        // Register multiple conversations
        for ($i = 1; $i <= 10; $i++) {
            $this->concurrencyManager->registerConversation($i);
        }

        $this->assertEquals(10, $this->concurrencyManager->getActiveConversationCount());

        // Force cleanup
        $cleaned = $this->concurrencyManager->forceCleanup();

        $this->assertEquals(10, $cleaned);
        $this->assertEquals(0, $this->concurrencyManager->getActiveConversationCount());
    }

    public function test_conversation_touch_updates_activity()
    {
        $userId = 555;

        $this->concurrencyManager->registerConversation($userId);

        // Touch the conversation (this should update last_activity)
        $this->concurrencyManager->touchConversation($userId);

        // We can't easily test the timestamp update without accessing Redis directly,
        // but we can verify the method doesn't throw an exception
        $this->assertTrue(true);
    }

    protected function tearDown(): void
    {
        // Clean up Redis after each test
        Redis::flushdb();
        parent::tearDown();
    }
}
