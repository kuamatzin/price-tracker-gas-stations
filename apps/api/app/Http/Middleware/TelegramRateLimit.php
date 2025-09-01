<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Telegram\Bot\Objects\Update;

class TelegramRateLimit
{
    protected int $perUserLimit;

    protected int $globalLimit;

    protected int $windowSize = 60; // 1 minute window

    public function __construct()
    {
        $this->perUserLimit = config('telegram.rate_limit_per_user', 30);
        $this->globalLimit = config('telegram.rate_limit_global', 1000);
    }

    /**
     * Handle an incoming request
     */
    public function handle(Request $request, Closure $next)
    {
        // Only apply to Telegram webhook requests
        if (! $this->isTelegramRequest($request)) {
            return $next($request);
        }

        $update = $this->parseUpdate($request);
        if (! $update) {
            return $next($request);
        }

        $userId = $this->extractUserId($update);
        if (! $userId) {
            return $next($request);
        }

        // Check admin bypass
        if ($this->isAdminUser($userId)) {
            return $next($request);
        }

        // Check rate limits
        $globalCheck = $this->checkGlobalRateLimit();
        $userCheck = $this->checkUserRateLimit($userId);

        if (! $globalCheck['allowed']) {
            return $this->handleRateLimitExceeded($update, 'global', $globalCheck);
        }

        if (! $userCheck['allowed']) {
            return $this->handleRateLimitExceeded($update, 'user', $userCheck);
        }

        // Record the request
        $this->recordRequest($userId);

        return $next($request);
    }

    /**
     * Check if request is from Telegram
     */
    protected function isTelegramRequest(Request $request): bool
    {
        return $request->is('api/telegram/*') || $request->is('telegram/*');
    }

    /**
     * Parse Telegram update from request
     */
    protected function parseUpdate(Request $request): ?Update
    {
        try {
            $data = $request->all();

            return new Update($data);
        } catch (\Exception $e) {
            Log::error('Failed to parse Telegram update: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Extract user ID from update
     */
    protected function extractUserId(Update $update): ?int
    {
        if ($update->getMessage()) {
            return $update->getMessage()->getFrom()->getId();
        }

        if ($update->getCallbackQuery()) {
            return $update->getCallbackQuery()->getFrom()->getId();
        }

        return null;
    }

    /**
     * Check global rate limit using sliding window
     */
    protected function checkGlobalRateLimit(): array
    {
        try {
            $key = 'telegram:rate_limit:global';
            $now = time();
            $windowStart = $now - $this->windowSize;

            // Remove old entries
            Redis::zremrangebyscore($key, 0, $windowStart);

            // Count current requests in window
            $currentCount = Redis::zcard($key);

            if ($currentCount >= $this->globalLimit) {
                return [
                    'allowed' => false,
                    'current_count' => $currentCount,
                    'limit' => $this->globalLimit,
                    'retry_after' => 60,
                ];
            }

            return [
                'allowed' => true,
                'current_count' => $currentCount,
                'limit' => $this->globalLimit,
                'remaining' => $this->globalLimit - $currentCount,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to check global rate limit: '.$e->getMessage());

            // Allow request if rate limiting fails
            return ['allowed' => true];
        }
    }

    /**
     * Check per-user rate limit using sliding window
     */
    protected function checkUserRateLimit(int $userId): array
    {
        try {
            $key = "telegram:rate_limit:user:{$userId}";
            $now = time();
            $windowStart = $now - $this->windowSize;

            // Remove old entries
            Redis::zremrangebyscore($key, 0, $windowStart);

            // Count current requests in window
            $currentCount = Redis::zcard($key);

            if ($currentCount >= $this->perUserLimit) {
                return [
                    'allowed' => false,
                    'current_count' => $currentCount,
                    'limit' => $this->perUserLimit,
                    'retry_after' => 60,
                ];
            }

            return [
                'allowed' => true,
                'current_count' => $currentCount,
                'limit' => $this->perUserLimit,
                'remaining' => $this->perUserLimit - $currentCount,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to check user rate limit: '.$e->getMessage());

            // Allow request if rate limiting fails
            return ['allowed' => true];
        }
    }

    /**
     * Record a request in the sliding window
     */
    protected function recordRequest(int $userId): void
    {
        try {
            $now = time();
            $score = $now; // Use timestamp as score for sliding window

            // Record global request
            $globalKey = 'telegram:rate_limit:global';
            Redis::zadd($globalKey, $score, uniqid());
            Redis::expire($globalKey, $this->windowSize * 2); // Keep for 2 windows

            // Record user request
            $userKey = "telegram:rate_limit:user:{$userId}";
            Redis::zadd($userKey, $score, uniqid());
            Redis::expire($userKey, $this->windowSize * 2);

        } catch (\Exception $e) {
            Log::error('Failed to record request: '.$e->getMessage());
        }
    }

    /**
     * Handle rate limit exceeded
     */
    protected function handleRateLimitExceeded(Update $update, string $limitType, array $limitInfo)
    {
        $chatId = $this->extractChatId($update);

        if ($chatId) {
            $this->sendRateLimitMessage($chatId, $limitType, $limitInfo);
        }

        Log::warning('Rate limit exceeded', [
            'type' => $limitType,
            'user_id' => $this->extractUserId($update),
            'current_count' => $limitInfo['current_count'] ?? 0,
            'limit' => $limitInfo['limit'] ?? 0,
        ]);

        return response()->json([
            'error' => 'Rate limit exceeded',
            'type' => $limitType,
            'retry_after' => $limitInfo['retry_after'] ?? 60,
        ], 429);
    }

    /**
     * Send rate limit message to user
     */
    protected function sendRateLimitMessage(int $chatId, string $limitType, array $limitInfo): void
    {
        try {
            $errorMessages = config('telegram.error_messages');
            $retryMinutes = round(($limitInfo['retry_after'] ?? 60) / 60, 1);

            $message = str_replace('{minutes}', $retryMinutes, $errorMessages['rate_limit']);

            if ($limitType === 'global') {
                $message = '🚦 El bot está muy ocupado. Por favor, intenta de nuevo en unos minutos.';
            }

            \Telegram\Bot\Laravel\Facades\Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $message,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send rate limit message: '.$e->getMessage());
        }
    }

    /**
     * Extract chat ID from update
     */
    protected function extractChatId(Update $update): ?int
    {
        if ($update->getMessage()) {
            return $update->getMessage()->getChat()->getId();
        }

        if ($update->getCallbackQuery()) {
            return $update->getCallbackQuery()->getMessage()->getChat()->getId();
        }

        return null;
    }

    /**
     * Check if user is admin (bypass rate limiting)
     */
    protected function isAdminUser(int $userId): bool
    {
        $adminIds = config('telegram.admin_chat_ids', []);

        return in_array($userId, $adminIds);
    }

    /**
     * Get rate limit statistics
     */
    public function getRateLimitStats(): array
    {
        try {
            $globalKey = 'telegram:rate_limit:global';
            $now = time();
            $windowStart = $now - $this->windowSize;

            // Clean up old entries
            Redis::zremrangebyscore($globalKey, 0, $windowStart);

            $globalCount = Redis::zcard($globalKey);

            // Get top users by request count
            $userPattern = 'telegram:rate_limit:user:*';
            $userKeys = Redis::keys($userPattern);

            $topUsers = [];
            foreach (array_slice($userKeys, 0, 10) as $key) {
                Redis::zremrangebyscore($key, 0, $windowStart);
                $count = Redis::zcard($key);

                if ($count > 0) {
                    $userId = str_replace('telegram:rate_limit:user:', '', $key);
                    $topUsers[$userId] = $count;
                }
            }

            arsort($topUsers);

            return [
                'global_requests_per_minute' => $globalCount,
                'global_limit' => $this->globalLimit,
                'per_user_limit' => $this->perUserLimit,
                'top_users' => array_slice($topUsers, 0, 5, true),
                'window_size_seconds' => $this->windowSize,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get rate limit stats: '.$e->getMessage());

            return [
                'error' => $e->getMessage(),
            ];
        }
    }
}
