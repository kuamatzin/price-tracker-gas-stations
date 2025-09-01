<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttachUserContext
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()) {
            // Attach user context for logging and monitoring
            $request->attributes->set('user_context', [
                'user_id' => $request->user()->id,
                'email' => $request->user()->email,
                'subscription_tier' => $request->user()->subscription_tier,
            ]);

            // Set Sentry user context if configured
            if (function_exists('sentry') && app()->bound('sentry')) {
                \Sentry\configureScope(function (\Sentry\State\Scope $scope) use ($request) {
                    $scope->setUser([
                        'id' => $request->user()->id,
                        'email' => $request->user()->email,
                        'subscription_tier' => $request->user()->subscription_tier,
                    ]);
                });
            }
        }

        return $next($request);
    }
}
