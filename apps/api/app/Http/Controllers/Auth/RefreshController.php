<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefreshController extends Controller
{
    /**
     * Refresh the authentication token.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get current token abilities before deletion
        $abilities = $request->user()->currentAccessToken()->abilities ?? ['*'];

        // Delete current token
        $request->user()->currentAccessToken()->delete();

        // Create new token with same abilities
        $token = $user->createToken('auth-token', $abilities)->plainTextToken;

        // Load stations relationship
        $user->load(['stations.municipio.entidad']);

        return response()->json([
            'token' => $token,
            'expires_at' => now()->addMinutes(config('sanctum.expiration'))->toISOString(),
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'stations' => $user->stations->map(function ($station) {
                    return [
                        'numero' => $station->numero,
                        'nombre' => $station->nombre,
                        'direccion' => $station->direccion,
                        'municipio' => $station->municipio?->nombre,
                        'entidad' => $station->municipio?->entidad?->nombre,
                        'lat' => $station->lat,
                        'lng' => $station->lng,
                        'brand' => $station->brand,
                        'role' => $station->pivot->role,
                        'assigned_at' => $station->pivot->created_at,
                    ];
                }),
                'default_station_numero' => $user->stations->first()?->numero,
                'subscription_tier' => $user->subscription_tier,
            ],
        ], 200);
    }
}
