<?php

namespace App\Telegram\Commands;

use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Commands\Command;

class MiEstacionCommand extends Command
{
    protected string $name = 'mi_estacion';

    protected string $description = 'Administrar mis estaciones registradas';

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        $user = User::where('telegram_chat_id', $chatId)->first();

        if (! $user) {
            $this->replyWithMessage([
                'text' => '❌ Necesitas registrarte primero. Usa /start para comenzar.',
            ]);

            return;
        }

        $this->displayStations($chatId, $user);
    }

    private function displayStations(int $chatId, User $user): void
    {
        $stations = $user->stations()->withPivot(['alias', 'is_default'])->get();

        if ($stations->isEmpty()) {
            $message = "📍 **Mis Estaciones**\n\n";
            $message .= "No tienes estaciones registradas.\n\n";
            $message .= "Para agregar una estación usa:\n";
            $message .= "`/registrar [número_estación] [alias]`\n\n";
            $message .= 'Ejemplo: `/registrar 12345 Mi Oficina`';

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            return;
        }

        $message = "📍 **Mis Estaciones Registradas**\n\n";

        $buttons = [];
        foreach ($stations as $index => $station) {
            $alias = $station->pivot->alias ?? $station->nombre;
            $isDefault = $station->pivot->is_default;

            $message .= sprintf(
                "%d. %s%s\n   📌 %s\n   🏷️ %s\n\n",
                $index + 1,
                $isDefault ? '⭐ ' : '',
                $alias,
                substr($station->direccion, 0, 50),
                $station->numero
            );

            $buttons[] = [
                [
                    'text' => ($isDefault ? '⭐ ' : '').$alias,
                    'callback_data' => "station_manage:{$station->numero}",
                ],
            ];
        }

        // Add option to add new station
        $buttons[] = [
            ['text' => '➕ Agregar nueva estación', 'callback_data' => 'station_add'],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $message .= 'Selecciona una estación para administrarla:';

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function showStationOptions(int $chatId, User $user, string $stationId): void
    {
        $station = Station::where('numero', $stationId)->first();

        if (! $station) {
            $this->replyWithMessage([
                'text' => '❌ Estación no encontrada.',
            ]);

            return;
        }

        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot(['alias', 'is_default'])
            ->first();

        if (! $userStation) {
            $this->replyWithMessage([
                'text' => '❌ Esta estación no está en tu lista.',
            ]);

            return;
        }

        $alias = $userStation->pivot->alias ?? $station->nombre;
        $isDefault = $userStation->pivot->is_default;

        $message = "⚙️ **Administrar Estación**\n\n";
        $message .= "📍 {$alias}\n";
        $message .= "📌 {$station->direccion}\n";
        $message .= "🏷️ {$station->numero}\n";

        if ($isDefault) {
            $message .= "⭐ Esta es tu estación predeterminada\n";
        }

        $message .= "\n¿Qué deseas hacer?";

        $buttons = [
            [
                ['text' => '✏️ Editar alias', 'callback_data' => "station_edit:{$stationId}"],
            ],
        ];

        if (! $isDefault) {
            $buttons[] = [
                ['text' => '⭐ Establecer como predeterminada', 'callback_data' => "station_default:{$stationId}"],
            ];
        }

        $buttons[] = [
            ['text' => '🗑️ Eliminar', 'callback_data' => "station_remove:{$stationId}"],
        ];

        $buttons[] = [
            ['text' => '⬅️ Regresar', 'callback_data' => 'station_back'],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function editStationAlias(int $chatId, User $user, string $stationId): void
    {
        // Store station ID in cache for the next message
        $cacheKey = "telegram:edit_alias:{$chatId}";
        Cache::put($cacheKey, $stationId, 300); // 5 minutes TTL

        $station = Station::where('numero', $stationId)->first();
        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot('alias')
            ->first();

        $currentAlias = $userStation->pivot->alias ?? $station->nombre;

        $message = "✏️ **Editar Alias de Estación**\n\n";
        $message .= "Estación: {$station->nombre}\n";
        $message .= "Alias actual: {$currentAlias}\n\n";
        $message .= 'Envía el nuevo alias para esta estación:';

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);
    }

    public function updateStationAlias(int $chatId, User $user, string $stationId, string $newAlias): void
    {
        $station = Station::where('numero', $stationId)->first();

        if (! $station) {
            $this->replyWithMessage([
                'text' => '❌ Estación no encontrada.',
            ]);

            return;
        }

        // Update the alias
        $user->stations()->updateExistingPivot($station->id, [
            'alias' => $newAlias,
            'updated_at' => now(),
        ]);

        // Clear cache
        Cache::forget("telegram:edit_alias:{$chatId}");
        Cache::forget("user:stations:{$user->id}");

        $message = "✅ Alias actualizado exitosamente.\n\n";
        $message .= "📍 Estación: {$station->nombre}\n";
        $message .= "🏷️ Nuevo alias: {$newAlias}";

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        // Show stations list again
        $this->displayStations($chatId, $user);

        Log::info('Station alias updated', [
            'user_id' => $user->id,
            'station_id' => $station->id,
            'new_alias' => $newAlias,
        ]);
    }

    public function setDefaultStation(int $chatId, User $user, string $stationId): void
    {
        $station = Station::where('numero', $stationId)->first();

        if (! $station) {
            $this->replyWithMessage([
                'text' => '❌ Estación no encontrada.',
            ]);

            return;
        }

        // Remove default from all user's stations
        $user->stations()->updateExistingPivot(
            $user->stations->pluck('id')->toArray(),
            ['is_default' => false]
        );

        // Set this station as default
        $user->stations()->updateExistingPivot($station->id, [
            'is_default' => true,
            'updated_at' => now(),
        ]);

        // Update primary station in preferences
        $preferences = $user->notification_preferences ?? [];
        $preferences['primary_station_id'] = $station->id;
        $user->notification_preferences = $preferences;
        $user->save();

        // Clear cache
        Cache::forget("user:stations:{$user->id}");
        Cache::forget("user:default_station:{$user->id}");

        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot('alias')
            ->first();

        $alias = $userStation->pivot->alias ?? $station->nombre;

        $message = "⭐ **Estación Predeterminada Actualizada**\n\n";
        $message .= "📍 {$alias}\n";
        $message .= "📌 {$station->direccion}\n\n";
        $message .= 'Esta estación se usará por defecto en todos tus comandos.';

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        // Show stations list again
        $this->displayStations($chatId, $user);

        Log::info('Default station updated', [
            'user_id' => $user->id,
            'station_id' => $station->id,
        ]);
    }

    public function confirmRemoveStation(int $chatId, User $user, string $stationId): void
    {
        $station = Station::where('numero', $stationId)->first();

        if (! $station) {
            $this->replyWithMessage([
                'text' => '❌ Estación no encontrada.',
            ]);

            return;
        }

        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot(['alias', 'is_default'])
            ->first();

        if ($userStation->pivot->is_default) {
            $this->replyWithMessage([
                'text' => "❌ No puedes eliminar tu estación predeterminada.\n\nPrimero establece otra estación como predeterminada.",
            ]);

            return;
        }

        $alias = $userStation->pivot->alias ?? $station->nombre;

        $message = "⚠️ **Confirmar Eliminación**\n\n";
        $message .= "¿Estás seguro que deseas eliminar esta estación?\n\n";
        $message .= "📍 {$alias}\n";
        $message .= "📌 {$station->direccion}\n";

        $buttons = [
            [
                ['text' => '✅ Sí, eliminar', 'callback_data' => "station_remove_confirm:{$stationId}"],
                ['text' => '❌ Cancelar', 'callback_data' => "station_manage:{$stationId}"],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function removeStation(int $chatId, User $user, string $stationId): void
    {
        $station = Station::where('numero', $stationId)->first();

        if (! $station) {
            $this->replyWithMessage([
                'text' => '❌ Estación no encontrada.',
            ]);

            return;
        }

        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot('alias')
            ->first();

        $alias = $userStation->pivot->alias ?? $station->nombre;

        // Remove station from user's list
        $user->stations()->detach($station->id);

        // Clear cache
        Cache::forget("user:stations:{$user->id}");

        $message = "✅ **Estación Eliminada**\n\n";
        $message .= "Se ha eliminado la estación:\n";
        $message .= "📍 {$alias}\n";

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        // Show stations list again
        $this->displayStations($chatId, $user);

        Log::info('Station removed from user list', [
            'user_id' => $user->id,
            'station_id' => $station->id,
        ]);
    }

    public function addNewStation(int $chatId, User $user): void
    {
        $message = "➕ **Agregar Nueva Estación**\n\n";
        $message .= "Para agregar una nueva estación, usa el comando:\n\n";
        $message .= "`/registrar [número_estación] [alias]`\n\n";
        $message .= "**Ejemplos:**\n";
        $message .= "`/registrar 12345 Mi Oficina`\n";
        $message .= "`/registrar 67890 Casa`\n\n";
        $message .= "El número de estación lo puedes encontrar en:\n";
        $message .= "• La aplicación oficial de gasolineras\n";
        $message .= "• El ticket de compra\n";
        $message .= "• Preguntando en la estación\n";

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);
    }
}
