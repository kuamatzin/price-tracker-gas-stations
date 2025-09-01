<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

class AuthenticateApiToken
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$abilities)
    {
        $token = $this->extractToken($request);

        if (! $token) {
            throw new UnauthorizedHttpException('', 'API token required');
        }

        $apiToken = ApiToken::findByToken($token);

        if (! $apiToken) {
            throw new UnauthorizedHttpException('', 'Invalid API token');
        }

        if ($apiToken->isExpired()) {
            throw new UnauthorizedHttpException('', 'API token expired');
        }

        // Check abilities if specified
        foreach ($abilities as $ability) {
            if (! $apiToken->can($ability)) {
                throw new UnauthorizedHttpException('', 'Insufficient permissions');
            }
        }

        // Update last used timestamp
        $apiToken->touch();

        // Make token available in request
        $request->merge(['api_token' => $apiToken]);

        return $next($request);
    }

    /**
     * Extract token from request
     */
    protected function extractToken(Request $request): ?string
    {
        // Check Authorization header first
        if ($request->bearerToken()) {
            return $request->bearerToken();
        }

        // Check X-API-Token header
        if ($request->header('X-API-Token')) {
            return $request->header('X-API-Token');
        }

        // Check query parameter as fallback
        return $request->query('api_token');
    }
}
