<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class RateLimitHeaders
{
    /**
     * Handle an incoming request.
     *
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only add headers for authenticated API requests
        if (! $request->user() || ! $request->is('api/*')) {
            return $response;
        }

        $user = $request->user();
        $tier = $user->subscription_tier ?? 'free';

        // Define rate limits per tier
        $limits = config('rate_limits.tiers', [
            'free' => 100,
            'basic' => 500,
            'premium' => 1000,
            'enterprise' => 10000,
        ]);

        $limit = $limits[$tier] ?? $limits['free'];

        // Create a unique key for the user's rate limit
        $key = 'rate_limit:'.$user->id.':'.now()->format('Y-m-d-H');

        // Get current usage count
        $current = (int) Redis::get($key) ?? 0;
        $remaining = max(0, $limit - $current);

        // Calculate reset time (next hour)
        $resetTime = now()->addHour()->startOfHour();

        // Add rate limit headers to response
        $response->headers->set('X-RateLimit-Limit', $limit);
        $response->headers->set('X-RateLimit-Remaining', $remaining);
        $response->headers->set('X-RateLimit-Reset', $resetTime->timestamp);

        // Add tier information
        $response->headers->set('X-RateLimit-Tier', $tier);

        // If rate limit is exceeded, add retry-after header
        if ($remaining <= 0) {
            $response->headers->set('Retry-After', $resetTime->diffInSeconds());
        }

        // Add usage percentage for convenience
        $usagePercent = round(($current / $limit) * 100, 2);
        $response->headers->set('X-RateLimit-Usage', $usagePercent.'%');

        return $response;
    }
}
