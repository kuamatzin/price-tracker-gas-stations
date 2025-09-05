<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AccountLockout;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    /**
     * Handle user login.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            Log::warning('Failed login attempt', ['email' => $request->email]);
            AccountLockout::recordFailedAttempt($request);

            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        // Clear failed attempts on successful login
        AccountLockout::clearFailedAttempts($request);

        // Revoke all previous tokens
        $user->tokens()->delete();

        // Create new token with abilities based on subscription tier
        $abilities = ['*'];
        if ($user->subscription_tier === 'premium') {
            $abilities[] = 'premium-features';
        }

        $token = $user->createToken('auth-token', $abilities)->plainTextToken;

        // Log successful login
        Log::info('User logged in successfully', ['user_id' => $user->id]);

        // Load stations relationship with municipio and entidad
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
