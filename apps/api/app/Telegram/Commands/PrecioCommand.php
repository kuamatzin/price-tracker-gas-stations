<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use App\Services\Telegram\InlineKeyboardBuilder;
use Telegram\Bot\Commands\Command;

class PrecioCommand extends Command
{
    protected string $name = 'precio';
    protected string $description = 'Buscar precios de cualquier estación';
    
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
        $searchTerm = trim($this->getArguments());

        if (empty($searchTerm)) {
            $this->replyWithMessage([
                'text' => "❌ Por favor especifica el nombre de la estación.\n\nEjemplo: /precio Pemex Centro"
            ]);
            return;
        }

        try {
            // Search for stations matching the term
            $stations = $this->pricingService->searchStations($searchTerm);

            if ($stations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No encontré estaciones con ese nombre.\n\nIntenta con otro término de búsqueda."
                ]);
                return;
            }

            if ($stations->count() === 1) {
                // Single match, show prices directly
                $this->showStationPrices($stations->first(), $chatId);
            } else {
                // Multiple matches, show selection
                $this->showStationSelection($stations, $chatId);
            }

        } catch (\Exception $e) {
            \Log::error('PrecioCommand error', [
                'chat_id' => $chatId,
                'search' => $searchTerm,
                'error' => $e->getMessage()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al buscar la estación. Por favor intenta más tarde."
            ]);
        }
    }

    private function showStationPrices($station, int $chatId): void
    {
        // Get current prices
        $prices = $this->pricingService->getCurrentStationPrices($station->numero);

        if ($prices->isEmpty()) {
            $this->replyWithMessage([
                'text' => "❌ No hay precios disponibles para esta estación."
            ]);
            return;
        }

        // Get price history for indicators
        $priceHistory = $this->pricingService->getPriceHistory($station->numero, 1);

        // Format response
        $response = "💰 **Precios Actuales**\n";
        $response .= "📍 {$station->nombre}\n";
        $response .= "📌 {$station->direccion}\n\n";

        $response .= "```\n";
        $response .= "Tipo     Precio   Cambio\n";
        $response .= "-------- -------- -------\n";

        foreach ($prices as $priceData) {
            $fuelType = ucfirst($priceData->fuel_type);
            $price = sprintf("$%.2f", $priceData->price);
            
            // Calculate change indicator
            $previousPrice = $priceHistory
                ->where('fuel_type', $priceData->fuel_type)
                ->sortByDesc('changed_at')
                ->skip(1)
                ->first();
            
            $indicator = '➡️';
            $changeText = '0%';
            
            if ($previousPrice) {
                $change = $priceData->price - $previousPrice->price;
                $changePercent = ($change / $previousPrice->price) * 100;
                
                if ($change > 0) {
                    $indicator = '📈';
                    $changeText = sprintf("+%.1f%%", $changePercent);
                } elseif ($change < 0) {
                    $indicator = '📉';
                    $changeText = sprintf("%.1f%%", $changePercent);
                }
            }
            
            $response .= sprintf(
                "%-8s %-8s %s %s\n",
                $fuelType,
                $price,
                $indicator,
                $changeText
            );
        }
        
        $response .= "```\n";
        
        // Add option to register station
        $response .= "\n💾 ¿Quieres registrar esta estación?\n";
        $response .= "Usa: `/registrar {$station->numero} [alias]`";

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    private function showStationSelection($stations, int $chatId): void
    {
        // Cache search results
        $cacheKey = "telegram:search:{$chatId}";
        cache()->put($cacheKey, $stations, 300);

        $response = "🔍 **Estaciones encontradas:**\n\n";
        
        $buttons = [];
        foreach ($stations->take(10) as $index => $station) {
            $response .= sprintf(
                "%d. %s\n   📌 %s\n\n",
                $index + 1,
                $station->nombre,
                substr($station->direccion, 0, 50)
            );
            
            $buttons[] = [
                'text' => ($index + 1) . ". " . substr($station->nombre, 0, 20),
                'callback_data' => "select_station:{$index}"
            ];
        }

        // Create inline keyboard with station options
        $keyboard = [
            'inline_keyboard' => array_chunk($buttons, 2)
        ];

        $this->replyWithMessage([
            'text' => $response . "\nSelecciona una estación:",
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    private function getUserId(int $chatId): ?int
    {
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();
        return $user ? $user->id : null;
    }
}