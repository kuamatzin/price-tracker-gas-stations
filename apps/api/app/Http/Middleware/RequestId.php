<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Str;

class RequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $request->header('X-Request-ID') ?? 'req_' . Str::random(16);
        
        $request->headers->set('X-Request-ID', $requestId);
        
        app()->instance('request.id', $requestId);
        
        $response = $next($request);
        
        $response->headers->set('X-Request-ID', $requestId);
        
        return $response;
    }
}