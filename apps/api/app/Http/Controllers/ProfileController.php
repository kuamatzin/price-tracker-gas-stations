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
        $user->load('station');

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'telegram_chat_id' => $user->telegram_chat_id,
                'station' => $user->station ? [
                    'numero' => $user->station->numero,
                    'nombre' => $user->station->nombre,
                    'franquicia' => $user->station->franquicia,
                    'direccion' => $user->station->direccion,
                    'municipio' => $user->station->municipio?->nombre,
                    'entidad' => $user->station->municipio?->entidad?->nombre,
                    'coordenadas' => $user->station->coordenadas,
                ] : null,
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

        // Update station association if provided
        if ($request->has('station_numero')) {
            $user->station()->updateOrCreate(
                ['user_id' => $user->id],
                ['station_numero' => $request->station_numero]
            );
        }

        $user->save();
        $user->load('station');

        return response()->json([
            'message' => 'Perfil actualizado exitosamente.',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'telegram_chat_id' => $user->telegram_chat_id,
                'station' => $user->station ? [
                    'numero' => $user->station->numero,
                    'nombre' => $user->station->nombre,
                    'franquicia' => $user->station->franquicia,
                    'direccion' => $user->station->direccion,
                    'municipio' => $user->station->municipio?->nombre,
                    'entidad' => $user->station->municipio?->entidad?->nombre,
                    'coordenadas' => $user->station->coordenadas,
                ] : null,
                'subscription_tier' => $user->subscription_tier,
                'notification_preferences' => $user->notification_preferences,
                'api_rate_limit' => $user->api_rate_limit,
            ],
        ], 200);
    }
}