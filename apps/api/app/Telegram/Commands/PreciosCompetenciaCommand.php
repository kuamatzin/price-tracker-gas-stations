<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use App\Services\Telegram\InlineKeyboardBuilder;
use Telegram\Bot\Commands\Command;

class PreciosCompetenciaCommand extends Command
{
    protected string $name = 'precios_competencia';
    protected string $description = 'Ver precios de competidores cercanos';
    
    private PricingService $pricingService;
    private TableFormatter $formatter;
    private InlineKeyboardBuilder $keyboardBuilder;

    public function __construct(
        PricingService $pricingService,
        TableFormatter $formatter,
        InlineKeyboardBuilder $keyboardBuilder
    ) {
        $this->pricingService = $pricingService;
        $this->formatter = $formatter;
        $this->keyboardBuilder = $keyboardBuilder;
    }

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        $userId = $this->getUserId($chatId);

        try {
            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación."
                ]);
                return;
            }

            // Check if we need to select a station
            if ($userStations->count() > 1) {
                // Store command context in session for callback handling
                cache()->put("telegram:session:{$chatId}:pending_command", 'precios_competencia', 300);
                
                $keyboard = $this->keyboardBuilder->buildStationSelection($userStations, 'precios_competencia');
                $this->replyWithMessage([
                    'text' => "📍 Selecciona una estación para ver competidores:",
                    'reply_markup' => $keyboard
                ]);
                return;
            }

            // Single station or selected from callback
            $selectedStation = $userStations->first();
            $this->showCompetitorPrices($selectedStation, $userId, $chatId);

        } catch (\Exception $e) {
            \Log::error('PreciosCompetenciaCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al consultar los competidores. Por favor intenta más tarde."
            ]);
        }
    }

    private function showCompetitorPrices($station, int $userId, int $chatId): void
    {
        // Get user's configured radius or use default
        $radius = cache()->get("telegram:user:{$userId}:radius", 5);

        // Get nearby competitor prices
        $nearbyStations = $this->pricingService->getNearbyCompetitorPrices(
            $station->lat,
            $station->lng,
            $radius,
            $station->station_numero // Exclude self
        );

        if ($nearbyStations->isEmpty()) {
            $this->replyWithMessage([
                'text' => "❌ No se encontraron competidores en un radio de {$radius}km."
            ]);
            return;
        }

        // Format response as table
        $response = "🏪 **Precios de Competidores**\n";
        $response .= "📍 Alrededor de: _{$station->alias}_\n";
        $response .= "📏 Radio: {$radius}km\n\n";

        $response .= "```\n";
        $response .= "Estación         Dist  Regular Premium Diesel\n";
        $response .= "---------------- ---- -------- ------- -------\n";

        foreach ($nearbyStations->take(10) as $competitor) {
            $name = substr($competitor->nombre, 0, 16);
            $name = str_pad($name, 16);
            $dist = sprintf("%3.1f", $competitor->distance);
            
            $regular = $competitor->regular_price ? sprintf("$%.2f", $competitor->regular_price) : "---";
            $premium = $competitor->premium_price ? sprintf("$%.2f", $competitor->premium_price) : "---";
            $diesel = $competitor->diesel_price ? sprintf("$%.2f", $competitor->diesel_price) : "---";
            
            $response .= sprintf(
                "%s %skm %8s %7s %7s\n",
                $name,
                $dist,
                $regular,
                $premium,
                $diesel
            );
        }
        $response .= "```\n";

        // Add option to save competitors
        if ($nearbyStations->count() > 0) {
            $response .= "\n💾 Usa /registrar [numero] para agregar una estación competidora";
        }

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
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