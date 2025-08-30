<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\PricingService;
use Telegram\Bot\Commands\Command;

class EstacionDefaultCommand extends Command
{
    protected string $name = 'estacion_default';
    protected string $description = 'Establecer tu estación predeterminada';
    
    private PricingService $pricingService;

    public function __construct(PricingService $pricingService)
    {
        $this->pricingService = $pricingService;
    }

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        $userId = $this->getUserId($chatId);
        $alias = trim($this->getArguments());

        if (empty($alias)) {
            $this->showAvailableStations($userId);
            return;
        }

        try {
            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación."
                ]);
                return;
            }

            // Find station by alias
            $station = $userStations->firstWhere('alias', $alias);

            if (!$station) {
                $this->replyWithMessage([
                    'text' => "❌ No encontré la estación '{$alias}'.\n\n" .
                             "Tus estaciones disponibles:\n" . 
                             $this->formatStationList($userStations)
                ]);
                return;
            }

            // Update default station
            $this->updateDefaultStation($userId, $station->id);

            // Clear cache
            cache()->forget("telegram:user:{$userId}:stations");

            $response = "✅ **Estación predeterminada establecida**\n\n";
            $response .= "📍 Alias: _{$station->alias}_\n";
            $response .= "🏪 Nombre: {$station->nombre}\n";
            $response .= "📌 Dirección: {$station->direccion}\n\n";
            $response .= "Ahora puedes usar `/precios` sin especificar estación.";

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown'
            ]);

        } catch (\Exception $e) {
            \Log::error('EstacionDefaultCommand error', [
                'chat_id' => $chatId,
                'alias' => $alias,
                'error' => $e->getMessage()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al establecer la estación predeterminada."
            ]);
        }
    }

    private function showAvailableStations(int $userId): void
    {
        try {
            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación."
                ]);
                return;
            }

            $currentDefault = $userStations->firstWhere('is_default', true);
            
            $response = "📍 **Establecer Estación Predeterminada**\n\n";
            
            if ($currentDefault) {
                $response .= "Actual: _{$currentDefault->alias}_\n\n";
            }
            
            $response .= "Usa el comando con el alias de la estación:\n";
            $response .= "`/estacion_default [alias]`\n\n";
            $response .= "**Tus estaciones:**\n";
            $response .= $this->formatStationList($userStations);

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown'
            ]);

        } catch (\Exception $e) {
            \Log::error('EstacionDefaultCommand showAvailableStations error', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al consultar tus estaciones."
            ]);
        }
    }

    private function formatStationList($stations): string
    {
        $list = "";
        foreach ($stations as $station) {
            $default = $station->is_default ? " ⭐" : "";
            $list .= "• `{$station->alias}` - {$station->nombre}{$default}\n";
        }
        return $list;
    }

    private function updateDefaultStation(int $userId, int $userStationId): void
    {
        // Clear any existing defaults for this user
        \DB::table('user_stations')
            ->where('user_id', $userId)
            ->update(['is_default' => false]);

        // Set new default
        \DB::table('user_stations')
            ->where('id', $userStationId)
            ->where('user_id', $userId)
            ->update([
                'is_default' => true,
                'updated_at' => now()
            ]);

        // Update user table default_station_alias
        $station = \DB::table('user_stations')
            ->where('id', $userStationId)
            ->first();

        if ($station) {
            \App\Models\User::where('id', $userId)
                ->update(['default_station_alias' => $station->alias]);
        }
    }

    private function getUserId(int $chatId): int
    {
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();
        
        if (!$user) {
            throw new \Exception('Usuario no registrado');
        }
        
        return $user->id;
    }
}