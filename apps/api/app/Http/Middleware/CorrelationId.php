<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class CorrelationId
{
    const HEADER_NAME = 'X-Correlation-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $correlationId = $request->header(self::HEADER_NAME) ?? Str::uuid()->toString();

        $request->headers->set(self::HEADER_NAME, $correlationId);

        config(['logging.context.correlation_id' => $correlationId]);

        $response = $next($request);

        $response->headers->set(self::HEADER_NAME, $correlationId);

        return $response;
    }
}
