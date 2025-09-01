<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailIsVerified
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $request->user()->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Por favor verifica tu correo electrónico antes de continuar.',
                'email_verified' => false,
            ], 403);
        }

        return $next($request);
    }
}
