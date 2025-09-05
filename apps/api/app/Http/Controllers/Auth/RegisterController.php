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

                $user->stations()->attach($station->numero, [
                    'role' => 'owner'
                ]);
            }

            // Create token
            $token = $user->createToken('auth-token')->plainTextToken;

            // Load stations relationship
            $user->load(['stations.municipio.entidad']);

            return response()->json([
                'token' => $token,
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
            ], 201);
        });
    }
}
