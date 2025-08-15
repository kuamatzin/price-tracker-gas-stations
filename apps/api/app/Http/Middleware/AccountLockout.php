<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class AccountLockout
{
    protected const MAX_ATTEMPTS = 5;
    protected const LOCKOUT_DURATION = 900; // 15 minutes in seconds

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->routeIs('auth.login')) {
            $key = $this->getLockoutKey($request);
            
            if ($this->isLockedOut($key)) {
                $seconds = $this->getBlockedSeconds($key);
                
                return response()->json([
                    'message' => sprintf(
                        'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en %d segundos.',
                        $seconds
                    ),
                ], 429);
            }
        }

        return $next($request);
    }

    /**
     * Check if the account is locked out.
     */
    protected function isLockedOut(string $key): bool
    {
        return Cache::has($key . ':lockout');
    }

    /**
     * Get the number of seconds until the lockout expires.
     */
    protected function getBlockedSeconds(string $key): int
    {
        $lockoutTime = Cache::get($key . ':lockout_time', 0);
        return max(0, self::LOCKOUT_DURATION - (time() - $lockoutTime));
    }

    /**
     * Get the lockout cache key.
     */
    protected function getLockoutKey(Request $request): string
    {
        return 'login_attempts:' . sha1($request->ip() . '|' . $request->input('email', ''));
    }

    /**
     * Record a failed login attempt.
     */
    public static function recordFailedAttempt(Request $request): void
    {
        $key = 'login_attempts:' . sha1($request->ip() . '|' . $request->input('email', ''));
        $attempts = Cache::get($key, 0) + 1;
        
        Cache::put($key, $attempts, self::LOCKOUT_DURATION);
        
        if ($attempts >= self::MAX_ATTEMPTS) {
            Cache::put($key . ':lockout', true, self::LOCKOUT_DURATION);
            Cache::put($key . ':lockout_time', time(), self::LOCKOUT_DURATION);
        }
    }

    /**
     * Clear failed attempts on successful login.
     */
    public static function clearFailedAttempts(Request $request): void
    {
        $key = 'login_attempts:' . sha1($request->ip() . '|' . $request->input('email', ''));
        Cache::forget($key);
        Cache::forget($key . ':lockout');
        Cache::forget($key . ':lockout_time');
    }
}