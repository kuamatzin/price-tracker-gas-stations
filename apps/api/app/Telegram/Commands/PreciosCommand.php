<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use App\Services\Telegram\InlineKeyboardBuilder;
use Telegram\Bot\Commands\Command;
use Telegram\Bot\Keyboard\Keyboard;

class PreciosCommand extends Command
{
    protected string $name = 'precios';
    protected string $description = 'Ver precios actuales de tu estación';
    
    private PricingService $pricingService;
    private TableFormatter $formatter;
    private InlineKeyboardBuilder $keyboardBuilder;
    private const MAX_RETRY_ATTEMPTS = 3;

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
        
        try {
            $userId = $this->getUserId($chatId);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => "❌ Usuario no registrado. Usa /start para registrarte."
            ]);
            return;
        }
        
        $arguments = $this->getArguments();

        // Parse arguments for station alias and fuel type
        $stationAlias = null;
        $fuelType = null;
        
        foreach ($arguments as $arg) {
            $lowerArg = strtolower($arg);
            if (in_array($lowerArg, ['regular', 'premium', 'diesel'])) {
                $fuelType = $lowerArg;
            } else {
                $stationAlias = $arg;
            }
        }

        try {
            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación."
                ]);
                return;
            }

            // Determine which station to use
            $selectedStation = null;
            
            if ($stationAlias) {
                // User specified an alias
                $selectedStation = $userStations->firstWhere('alias', $stationAlias);
                if (!$selectedStation) {
                    $this->replyWithMessage([
                        'text' => "❌ No encontré la estación '$stationAlias'.\n\n" .
                                 "Tus estaciones: " . $userStations->pluck('alias')->implode(', ')
                    ]);
                    return;
                }
            } elseif ($userStations->count() === 1) {
                // Single station, use it
                $selectedStation = $userStations->first();
            } else {
                // Multiple stations, check for default
                $defaultStation = $userStations->firstWhere('is_default', true);
                
                if ($defaultStation) {
                    $selectedStation = $defaultStation;
                } else {
                    // No default, show selection keyboard
                    $keyboard = $this->keyboardBuilder->buildStationSelection($userStations, 'precios');
                    $this->replyWithMessage([
                        'text' => "📍 Selecciona una estación:",
                        'reply_markup' => $keyboard
                    ]);
                    return;
                }
            }

            // Get prices for selected station
            $prices = $this->pricingService->getCurrentStationPrices(
                $selectedStation->station_numero,
                $fuelType
            );

            if ($prices->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No hay precios disponibles para esta estación."
                ]);
                return;
            }

            // Get price history for indicators
            $priceHistory = $this->pricingService->getPriceHistory(
                $selectedStation->station_numero,
                1 // Last 24 hours
            );

            // Format response
            $response = $this->formatter->formatStationPrices(
                $selectedStation,
                $prices,
                $priceHistory
            );

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown'
            ]);

        } catch (\Exception $e) {
            \Log::error('PreciosCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al consultar los precios. Por favor intenta más tarde."
            ]);
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