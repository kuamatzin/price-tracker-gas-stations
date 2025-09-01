<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class ConcurrencyManager
{
    protected int $maxConcurrentConversations;

    protected string $activeConversationsKey = 'telegram:active_conversations';

    protected string $requestQueueKey = 'telegram:request_queue';

    protected int $backpressureThreshold;

    public function __construct()
    {
        $this->maxConcurrentConversations = config('telegram.max_concurrent_conversations', 100);
        $this->backpressureThreshold = (int) ($this->maxConcurrentConversations * 0.8); // 80% of max
    }

    /**
     * Register an active conversation
     */
    public function registerConversation(int $userId): bool
    {
        // Input validation
        if ($userId <= 0) {
            Log::error('Invalid user ID for conversation registration', ['user_id' => $userId]);
            return false;
        }

        try {
            $activeCount = $this->getActiveConversationCount();

            if ($activeCount >= $this->maxConcurrentConversations) {
                Log::warning('Max concurrent conversations reached', [
                    'current_count' => $activeCount,
                    'max_allowed' => $this->maxConcurrentConversations,
                    'user_id' => $userId,
                ]);

                return false;
            }

            $conversationKey = "telegram:conversation:{$userId}";

            // Set conversation as active with 5-minute TTL
            Redis::setex($conversationKey, 300, json_encode([
                'user_id' => $userId,
                'started_at' => time(),
                'last_activity' => time(),
            ]));

            // Add to active conversations set
            Redis::sadd($this->activeConversationsKey, $userId);
            Redis::expire($this->activeConversationsKey, 3600); // 1 hour TTL for the set

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to register conversation: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Update conversation activity timestamp
     */
    public function touchConversation(int $userId): void
    {
        // Input validation
        if ($userId <= 0) {
            Log::error('Invalid user ID for conversation touch', ['user_id' => $userId]);
            return;
        }

        try {
            $conversationKey = "telegram:conversation:{$userId}";
            $data = Redis::get($conversationKey);

            if ($data) {
                $conversation = json_decode($data, true);
                $conversation['last_activity'] = time();

                Redis::setex($conversationKey, 300, json_encode($conversation));
            }
        } catch (\Exception $e) {
            Log::error('Failed to touch conversation: '.$e->getMessage());
        }
    }

    /**
     * Unregister a conversation
     */
    public function unregisterConversation(int $userId): void
    {
        // Input validation
        if ($userId <= 0) {
            Log::error('Invalid user ID for conversation unregistration', ['user_id' => $userId]);
            return;
        }

        try {
            $conversationKey = "telegram:conversation:{$userId}";

            Redis::del($conversationKey);
            Redis::srem($this->activeConversationsKey, $userId);
        } catch (\Exception $e) {
            Log::error('Failed to unregister conversation: '.$e->getMessage());
        }
    }

    /**
     * Get current active conversation count
     */
    public function getActiveConversationCount(): int
    {
        try {
            // Clean up expired conversations first
            $this->cleanupExpiredConversations();

            return Redis::scard($this->activeConversationsKey);
        } catch (\Exception $e) {
            Log::error('Failed to get active conversation count: '.$e->getMessage());

            return 0;
        }
    }

    /**
     * Check if system is under backpressure
     */
    public function isUnderBackpressure(): bool
    {
        $activeCount = $this->getActiveConversationCount();

        return $activeCount >= $this->backpressureThreshold;
    }

    /**
     * Check if new conversations can be accepted
     */
    public function canAcceptNewConversation(): bool
    {
        $activeCount = $this->getActiveConversationCount();

        return $activeCount < $this->maxConcurrentConversations;
    }

    /**
     * Get conversation statistics
     */
    public function getStats(): array
    {
        $activeCount = $this->getActiveConversationCount();

        return [
            'active_conversations' => $activeCount,
            'max_conversations' => $this->maxConcurrentConversations,
            'utilization_percentage' => round(($activeCount / $this->maxConcurrentConversations) * 100, 2),
            'under_backpressure' => $this->isUnderBackpressure(),
            'can_accept_new' => $this->canAcceptNewConversation(),
            'backpressure_threshold' => $this->backpressureThreshold,
        ];
    }

    /**
     * Queue a request when under backpressure
     */
    public function queueRequest(array $requestData): bool
    {
        try {
            $queueItem = [
                'id' => uniqid(),
                'user_id' => $requestData['user_id'],
                'message' => $requestData['message'],
                'queued_at' => time(),
                'priority' => $requestData['priority'] ?? 'normal',
            ];

            Redis::lpush($this->requestQueueKey, json_encode($queueItem));
            Redis::expire($this->requestQueueKey, 1800); // 30 minutes TTL

            Log::info('Request queued due to backpressure', [
                'queue_id' => $queueItem['id'],
                'user_id' => $requestData['user_id'],
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to queue request: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Process queued requests
     */
    public function processQueuedRequests(): array
    {
        $processed = [];

        try {
            while ($this->canAcceptNewConversation()) {
                $queuedItem = Redis::rpop($this->requestQueueKey);

                if (! $queuedItem) {
                    break; // Queue is empty
                }

                $request = json_decode($queuedItem, true);

                // Process the queued request
                if ($this->registerConversation($request['user_id'])) {
                    $processed[] = $request;

                    Log::info('Processed queued request', [
                        'queue_id' => $request['id'],
                        'user_id' => $request['user_id'],
                        'wait_time' => time() - $request['queued_at'],
                    ]);
                } else {
                    // Put it back if we couldn't process it
                    Redis::rpush($this->requestQueueKey, $queuedItem);
                    break;
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to process queued requests: '.$e->getMessage());
        }

        return $processed;
    }

    /**
     * Get queue statistics
     */
    public function getQueueStats(): array
    {
        try {
            $queueLength = Redis::llen($this->requestQueueKey);

            return [
                'queue_length' => $queueLength,
                'oldest_request_age' => $this->getOldestRequestAge(),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get queue stats: '.$e->getMessage());

            return [
                'queue_length' => 0,
                'oldest_request_age' => 0,
            ];
        }
    }

    /**
     * Clean up expired conversations
     */
    protected function cleanupExpiredConversations(): void
    {
        try {
            $members = Redis::smembers($this->activeConversationsKey);

            foreach ($members as $userId) {
                $conversationKey = "telegram:conversation:{$userId}";

                if (! Redis::exists($conversationKey)) {
                    // Conversation expired, remove from active set
                    Redis::srem($this->activeConversationsKey, $userId);
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to cleanup expired conversations: '.$e->getMessage());
        }
    }

    /**
     * Get age of oldest queued request in seconds
     */
    protected function getOldestRequestAge(): int
    {
        try {
            $oldestItem = Redis::lindex($this->requestQueueKey, -1);

            if ($oldestItem) {
                $request = json_decode($oldestItem, true);

                return time() - $request['queued_at'];
            }
        } catch (\Exception $e) {
            Log::error('Failed to get oldest request age: '.$e->getMessage());
        }

        return 0;
    }

    /**
     * Force cleanup of all conversations (admin function)
     */
    public function forceCleanup(): int
    {
        try {
            $count = Redis::scard($this->activeConversationsKey);

            // Clear active conversations set
            Redis::del($this->activeConversationsKey);

            // Clear individual conversation keys
            $pattern = 'telegram:conversation:*';
            $keys = Redis::keys($pattern);
            if (! empty($keys)) {
                Redis::del($keys);
            }

            Log::info('Force cleanup completed', ['cleared_conversations' => $count]);

            return $count;
        } catch (\Exception $e) {
            Log::error('Failed to force cleanup: '.$e->getMessage());

            return 0;
        }
    }

    /**
     * Get connection pool settings for Redis
     */
    public function getConnectionPoolSettings(): array
    {
        return [
            'min_connections' => config('database.redis.options.min_connections', 1),
            'max_connections' => config('database.redis.options.max_connections', 10),
            'connection_timeout' => config('database.redis.options.connection_timeout', 5.0),
            'read_timeout' => config('database.redis.options.read_timeout', 5.0),
        ];
    }
}
