<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $request->header('X-Request-ID') ?? uniqid('req_');
        $request->headers->set('X-Request-ID', $requestId);
        
        $startTime = microtime(true);
        
        Log::channel('api')->info('API Request', [
            'request_id' => $requestId,
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        
        $response = $next($request);
        
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        
        Log::channel('api')->info('API Response', [
            'request_id' => $requestId,
            'status' => $response->getStatusCode(),
            'duration_ms' => $duration,
        ]);
        
        $response->headers->set('X-Request-ID', $requestId);
        $response->headers->set('X-Response-Time', $duration . 'ms');
        
        return $response;
    }
}