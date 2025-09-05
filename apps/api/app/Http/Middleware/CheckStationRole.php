<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckStationRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'error' => [
                    'status' => 401,
                    'code' => 'UNAUTHENTICATED',
                    'title' => 'Unauthenticated',
                    'detail' => 'Authentication required',
                ]
            ], 401);
        }

        $stationNumero = $request->input('station_numero') 
            ?? $request->route('numero')
            ?? $request->header('X-Station-Numero');

        if (!$stationNumero) {
            return response()->json([
                'error' => [
                    'status' => 422,
                    'code' => 'MISSING_STATION',
                    'title' => 'Station Required',
                    'detail' => 'station_numero is required',
                ]
            ], 422);
        }

        // Check if user has one of the required roles for this station
        $hasRole = $user->stations()
            ->where('station_numero', $stationNumero)
            ->wherePivotIn('role', $roles)
            ->exists();

        if (!$hasRole) {
            $rolesText = count($roles) === 1 ? $roles[0] : implode(' or ', $roles);
            
            return response()->json([
                'error' => [
                    'status' => 403,
                    'code' => 'INSUFFICIENT_ROLE',
                    'title' => 'Insufficient Permissions',
                    'detail' => "You must have {$rolesText} role for this station",
                ]
            ], 403);
        }

        return $next($request);
    }
}