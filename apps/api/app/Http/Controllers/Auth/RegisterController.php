<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Station;
use App\Models\User;
use App\Models\UserStation;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            // Create the user
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'subscription_tier' => 'free',
                'api_rate_limit' => 100,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => false,
                ],
            ]);

            // Associate user with station if provided
            if ($request->has('station_numero')) {
                $station = Station::where('numero', $request->station_numero)->firstOrFail();

                UserStation::create([
                    'user_id' => $user->id,
                    'station_numero' => $station->numero,
                    'role' => 'owner',
                ]);
            }

            // Create token
            $token = $user->createToken('auth-token')->plainTextToken;

            // Load station relationship
            $user->load('station');

            return response()->json([
                'token' => $token,
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
            ], 201);
        });
    }
}
