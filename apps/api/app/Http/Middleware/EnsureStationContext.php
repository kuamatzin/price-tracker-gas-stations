<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStationContext
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Extract station_numero from request (query param, header, or route param)
        $stationNumero = $request->query('station_numero') 
            ?? $request->header('X-Station-Numero')
            ?? $request->route('station_numero');

        if (!$stationNumero) {
            return response()->json([
                'error' => [
                    'status' => 422,
                    'code' => 'MISSING_STATION_CONTEXT',
                    'title' => 'Station Context Required',
                    'detail' => 'station_numero is required for this endpoint',
                    'hint' => 'Provide station_numero as query parameter or X-Station-Numero header',
                ]
            ], 422);
        }

        // Validate user has access to this station
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'error' => [
                    'status' => 401,
                    'code' => 'UNAUTHENTICATED',
                    'title' => 'Authentication Required',
                    'detail' => 'You must be authenticated to access this resource',
                ]
            ], 401);
        }

        $userStation = $user->stations()
            ->where('station_numero', $stationNumero)
            ->first();
            
        if (!$userStation) {
            return response()->json([
                'error' => [
                    'status' => 403,
                    'code' => 'STATION_ACCESS_DENIED',
                    'title' => 'Access Denied',
                    'detail' => 'You do not have access to this station',
                    'hint' => 'Ensure the station is assigned to your account',
                ]
            ], 403);
        }
        
        // Add station context to request
        $request->merge([
            'station_numero' => $stationNumero,
            'current_station' => $userStation,
            'station_role' => $userStation->pivot->role
        ]);

        return $next($request);
    }
}