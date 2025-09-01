<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class SessionManager
{
    /**
     * Session TTL in seconds (30 minutes)
     */
    const TTL = 1800;

    /**
     * Compression enabled flag
     */
    protected bool $compressionEnabled;

    /**
     * Redis connection pool size
     */
    protected int $connectionPoolSize;

    public function __construct()
    {
        $this->compressionEnabled = config('telegram.session_compression', true);
        $this->connectionPoolSize = config('database.redis.options.max_connections', 10);
    }

    /**
     * Get or create a session for a Telegram user
     */
    public function getSession(int $userId): TelegramSession
    {
        // Input validation
        if ($userId <= 0) {
            Log::error('Invalid user ID for session retrieval', ['user_id' => $userId]);
            return new TelegramSession(['user_id' => $userId]);
        }

        $key = $this->getSessionKey($userId);

        try {
            $data = Redis::get($key);

            if ($data) {
                $sessionData = $this->compressionEnabled ?
                    $this->decompressData($data) :
                    json_decode($data, true);

                return new TelegramSession($sessionData);
            }
        } catch (\Exception $e) {
            Log::error('Failed to get Telegram session: '.$e->getMessage(), [
                'user_id' => $userId,
                'key' => $key,
            ]);
        }

        // Create new session if none exists
        return new TelegramSession(['user_id' => $userId]);
    }

    /**
     * Save a session
     */
    public function saveSession(TelegramSession $session): bool
    {
        // Input validation
        if ($session->getUserId() <= 0) {
            Log::error('Invalid user ID in session for saving', ['user_id' => $session->getUserId()]);
            return false;
        }

        $key = $this->getSessionKey($session->getUserId());

        try {
            $data = $this->compressionEnabled ?
                $this->compressData($session->toArray()) :
                json_encode($session->toArray());

            return Redis::setex($key, self::TTL, $data);
        } catch (\Exception $e) {
            Log::error('Failed to save Telegram session: '.$e->getMessage(), [
                'user_id' => $session->getUserId(),
                'key' => $key,
            ]);

            return false;
        }
    }

    /**
     * Destroy a session
     */
    public function destroySession(int $userId): bool
    {
        $key = $this->getSessionKey($userId);

        try {
            return Redis::del($key) > 0;
        } catch (\Exception $e) {
            Log::error('Failed to destroy Telegram session: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Extend session TTL
     */
    public function touchSession(int $userId): bool
    {
        $key = $this->getSessionKey($userId);

        try {
            return Redis::expire($key, self::TTL);
        } catch (\Exception $e) {
            Log::error('Failed to touch Telegram session: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Check if session exists
     */
    public function hasSession(int $userId): bool
    {
        $key = $this->getSessionKey($userId);

        try {
            return Redis::exists($key);
        } catch (\Exception $e) {
            Log::error('Failed to check Telegram session existence: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Get all active sessions (for admin purposes)
     */
    public function getActiveSessions(): array
    {
        try {
            $pattern = $this->getSessionKey('*');
            $keys = Redis::keys($pattern);

            $sessions = [];
            foreach ($keys as $key) {
                $data = Redis::get($key);
                if ($data) {
                    $sessions[] = json_decode($data, true);
                }
            }

            return $sessions;
        } catch (\Exception $e) {
            Log::error('Failed to get active Telegram sessions: '.$e->getMessage());

            return [];
        }
    }

    /**
     * Get session key for Redis
     */
    protected function getSessionKey($userId): string
    {
        return "telegram:session:{$userId}";
    }

    /**
     * Clean up expired sessions (called by scheduler)
     */
    public function cleanupExpiredSessions(): int
    {
        try {
            $pattern = $this->getSessionKey('*');
            $keys = Redis::keys($pattern);
            $cleaned = 0;

            // Batch process expired keys
            $batchSize = 100;
            $batches = array_chunk($keys, $batchSize);

            foreach ($batches as $batch) {
                $pipeline = Redis::pipeline();

                foreach ($batch as $key) {
                    $pipeline->ttl($key);
                }

                $ttls = $pipeline->execute();

                // Remove keys that have expired or are about to expire
                $keysToDelete = [];
                foreach ($batch as $index => $key) {
                    if ($ttls[$index] <= 0) {
                        $keysToDelete[] = $key;
                    }
                }

                if (! empty($keysToDelete)) {
                    Redis::del($keysToDelete);
                    $cleaned += count($keysToDelete);
                }
            }

            Log::info('Session cleanup completed', ['cleaned_sessions' => $cleaned]);

            return $cleaned;
        } catch (\Exception $e) {
            Log::error('Failed to cleanup expired sessions: '.$e->getMessage());

            return 0;
        }
    }

    /**
     * Get session persistence metrics
     */
    public function getSessionMetrics(): array
    {
        try {
            $pattern = $this->getSessionKey('*');
            $keys = Redis::keys($pattern);
            $totalSessions = count($keys);

            $avgTtl = 0;
            $totalSize = 0;

            if ($totalSessions > 0) {
                $pipeline = Redis::pipeline();

                foreach ($keys as $key) {
                    $pipeline->ttl($key);
                    $pipeline->strlen($key);
                }

                $results = $pipeline->execute();

                $ttlSum = 0;
                $sizeSum = 0;

                for ($i = 0; $i < count($results); $i += 2) {
                    $ttlSum += max(0, $results[$i]);
                    $sizeSum += $results[$i + 1];
                }

                $avgTtl = $totalSessions > 0 ? round($ttlSum / $totalSessions) : 0;
                $totalSize = $sizeSum;
            }

            return [
                'total_sessions' => $totalSessions,
                'average_ttl_seconds' => $avgTtl,
                'total_size_bytes' => $totalSize,
                'compression_enabled' => $this->compressionEnabled,
                'connection_pool_size' => $this->connectionPoolSize,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get session metrics: '.$e->getMessage());

            return [
                'total_sessions' => 0,
                'average_ttl_seconds' => 0,
                'total_size_bytes' => 0,
                'compression_enabled' => $this->compressionEnabled,
                'connection_pool_size' => $this->connectionPoolSize,
            ];
        }
    }

    /**
     * Implement session recovery mechanism
     */
    public function recoverSession(int $userId): ?TelegramSession
    {
        try {
            // Try to recover from backup if main session is corrupted
            $backupKey = $this->getSessionKey($userId).':backup';
            $data = Redis::get($backupKey);

            if ($data) {
                $sessionData = $this->compressionEnabled ?
                    $this->decompressData($data) :
                    json_decode($data, true);

                Log::info('Session recovered from backup', ['user_id' => $userId]);

                return new TelegramSession($sessionData);
            }
        } catch (\Exception $e) {
            Log::error('Failed to recover session: '.$e->getMessage());
        }

        return null;
    }

    /**
     * Create session backup
     */
    protected function createSessionBackup(TelegramSession $session): void
    {
        try {
            $backupKey = $this->getSessionKey($session->getUserId()).':backup';
            $data = $this->compressionEnabled ?
                $this->compressData($session->toArray()) :
                json_encode($session->toArray());

            Redis::setex($backupKey, self::TTL, $data);
        } catch (\Exception $e) {
            Log::error('Failed to create session backup: '.$e->getMessage());
        }
    }

    /**
     * Compress session data using gzip
     */
    protected function compressData(array $data): string
    {
        return base64_encode(gzcompress(json_encode($data), 6));
    }

    /**
     * Decompress session data
     */
    protected function decompressData(string $data): array
    {
        $decompressed = gzuncompress(base64_decode($data));

        return json_decode($decompressed, true);
    }

    /**
     * Batch get multiple sessions
     */
    public function getBatchSessions(array $userIds): array
    {
        try {
            $keys = array_map(fn ($userId) => $this->getSessionKey($userId), $userIds);
            $pipeline = Redis::pipeline();

            foreach ($keys as $key) {
                $pipeline->get($key);
            }

            $results = $pipeline->execute();
            $sessions = [];

            foreach ($userIds as $index => $userId) {
                $data = $results[$index];

                if ($data) {
                    $sessionData = $this->compressionEnabled ?
                        $this->decompressData($data) :
                        json_decode($data, true);
                    $sessions[$userId] = new TelegramSession($sessionData);
                } else {
                    $sessions[$userId] = new TelegramSession(['user_id' => $userId]);
                }
            }

            return $sessions;
        } catch (\Exception $e) {
            Log::error('Failed to get batch sessions: '.$e->getMessage());

            // Fallback to individual gets
            $sessions = [];
            foreach ($userIds as $userId) {
                $sessions[$userId] = $this->getSession($userId);
            }

            return $sessions;
        }
    }

    /**
     * Enhanced save with backup creation
     */
    public function saveSessionWithBackup(TelegramSession $session): bool
    {
        $saved = $this->saveSession($session);

        if ($saved) {
            $this->createSessionBackup($session);
        }

        return $saved;
    }
}
