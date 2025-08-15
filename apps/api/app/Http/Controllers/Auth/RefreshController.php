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

        // Load station relationship
        $user->load('station');

        return response()->json([
            'token' => $token,
            'expires_at' => now()->addMinutes(config('sanctum.expiration'))->toISOString(),
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'station' => $user->station ? [
                    'numero' => $user->station->numero,
                    'nombre' => $user->station->nombre,
                    'municipio' => $user->station->municipio?->nombre,
                    'entidad' => $user->station->municipio?->entidad?->nombre,
                ] : null,
                'subscription_tier' => $user->subscription_tier,
            ],
        ], 200);
    }
}