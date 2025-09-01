<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter as RateLimiterFacade;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class ThrottleByTier
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            // For unauthenticated users, use default rate limit
            return $this->handleRateLimit($request, $next, 60, 10);
        }

        $user = $request->user();
        $tier = $user->subscription_tier ?? 'free';

        // Get rate limits based on subscription tier
        [$limit, $burst] = $this->getTierLimits($tier);

        return $this->handleRateLimit($request, $next, $limit, $burst, $user->id);
    }

    /**
     * Get rate limits for a subscription tier.
     */
    protected function getTierLimits(string $tier): array
    {
        $limits = config('rate_limits.tiers', [
            'free' => [
                'requests_per_hour' => 100,
                'burst' => 10,
            ],
            'basic' => [
                'requests_per_hour' => 500,
                'burst' => 50,
            ],
            'premium' => [
                'requests_per_hour' => 1000,
                'burst' => 100,
            ],
        ]);

        $tierConfig = $limits[$tier] ?? $limits['free'];

        return [
            $tierConfig['requests_per_hour'],
            $tierConfig['burst'],
        ];
    }

    /**
     * Handle rate limiting for the request.
     */
    protected function handleRateLimit(Request $request, Closure $next, int $limit, int $burst, ?string $userId = null): Response
    {
        $key = $this->resolveRequestKey($request, $userId);
        $maxAttempts = $limit;

        if (RateLimiterFacade::tooManyAttempts($key, $maxAttempts)) {
            $seconds = RateLimiterFacade::availableIn($key);

            throw new TooManyRequestsHttpException(
                $seconds,
                sprintf('Has excedido el límite de %d solicitudes por hora. Por favor, intenta de nuevo en %d segundos.', $limit, $seconds)
            );
        }

        RateLimiterFacade::hit($key, 3600); // 1 hour decay

        $response = $next($request);

        // Add rate limit headers
        $response->headers->set('X-RateLimit-Limit', $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining', RateLimiterFacade::remaining($key, $maxAttempts));
        $response->headers->set('X-RateLimit-Reset', RateLimiterFacade::availableIn($key) + time());

        return $response;
    }

    /**
     * Resolve the request key for rate limiting.
     */
    protected function resolveRequestKey(Request $request, ?string $userId = null): string
    {
        if ($userId) {
            return 'throttle_tier:'.$userId;
        }

        return 'throttle_tier:'.sha1($request->ip());
    }
}
