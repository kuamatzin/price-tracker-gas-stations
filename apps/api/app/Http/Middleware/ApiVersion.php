<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ApiVersion
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  $version
     * @return mixed
     */
    public function handle(Request $request, Closure $next, string $version = 'v1')
    {
        // Set the API version in headers
        $request->headers->set('API-Version', $version);

        // Add deprecation warning for v1
        if ($version === 'v1') {
            $response = $next($request);
            
            // Add sunset headers for v1 deprecation
            $response->headers->set(
                'Sunset',
                'Sat, 31 Dec 2024 23:59:59 GMT'
            );
            $response->headers->set(
                'Deprecation',
                'version="v1", date="2024-12-31"'
            );
            $response->headers->set(
                'Link',
                '<https://api.fuelintel.mx/v2>; rel="successor-version"'
            );
            
            return $response;
        }

        return $next($request);
    }
}