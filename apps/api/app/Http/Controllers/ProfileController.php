<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateProfileRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    /**
     * Get the authenticated user's profile.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['stations.municipio.entidad']);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'telegram_chat_id' => $user->telegram_chat_id,
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
                'notification_preferences' => $user->notification_preferences,
                'api_rate_limit' => $user->api_rate_limit,
                'created_at' => $user->created_at,
                'email_verified_at' => $user->email_verified_at,
            ],
        ], 200);
    }

    /**
     * Update the authenticated user's profile.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        // Update basic information
        $user->fill($request->only([
            'name',
            'telegram_chat_id',
            'notification_preferences',
        ]));

        // Update password if provided
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
            // Revoke all tokens except current one for security
            $user->tokens()
                ->where('id', '!=', $user->currentAccessToken()->id)
                ->delete();
        }

        // Update default station if provided
        if ($request->has('default_station_numero')) {
            // Verify user has access to this station
            $hasStation = $user->stations()
                ->where('station_numero', $request->default_station_numero)
                ->exists();
            
            if (!$hasStation) {
                return response()->json([
                    'error' => 'You do not have access to this station'
                ], 403);
            }
            
            // Store default station preference (could be in user preferences)
            $user->notification_preferences = array_merge(
                $user->notification_preferences ?? [],
                ['default_station_numero' => $request->default_station_numero]
            );
        }

        $user->save();
        $user->load(['stations.municipio.entidad']);

        return response()->json([
            'message' => 'Perfil actualizado exitosamente.',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'telegram_chat_id' => $user->telegram_chat_id,
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
                'default_station_numero' => $user->notification_preferences['default_station_numero'] 
                    ?? $user->stations->first()?->numero,
                'subscription_tier' => $user->subscription_tier,
                'notification_preferences' => $user->notification_preferences,
                'api_rate_limit' => $user->api_rate_limit,
            ],
        ], 200);
    }
}
