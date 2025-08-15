<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

class SessionManager
{
    /**
     * Session TTL in seconds (30 minutes)
     */
    const TTL = 1800;

    /**
     * Get or create a session for a Telegram user
     */
    public function getSession(int $userId): TelegramSession
    {
        $key = $this->getSessionKey($userId);
        
        try {
            $data = Redis::get($key);
            
            if ($data) {
                $sessionData = json_decode($data, true);
                return new TelegramSession($sessionData);
            }
        } catch (\Exception $e) {
            Log::error('Failed to get Telegram session: ' . $e->getMessage());
        }
        
        // Create new session if none exists
        return new TelegramSession(['user_id' => $userId]);
    }

    /**
     * Save a session
     */
    public function saveSession(TelegramSession $session): bool
    {
        $key = $this->getSessionKey($session->getUserId());
        
        try {
            return Redis::setex(
                $key,
                self::TTL,
                json_encode($session->toArray())
            );
        } catch (\Exception $e) {
            Log::error('Failed to save Telegram session: ' . $e->getMessage());
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
            Log::error('Failed to destroy Telegram session: ' . $e->getMessage());
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
            Log::error('Failed to touch Telegram session: ' . $e->getMessage());
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
            Log::error('Failed to check Telegram session existence: ' . $e->getMessage());
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
            Log::error('Failed to get active Telegram sessions: ' . $e->getMessage());
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
        // Redis handles expiration automatically with SETEX
        // This method is here for future custom cleanup logic if needed
        return 0;
    }
}