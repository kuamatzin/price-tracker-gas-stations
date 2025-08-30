<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use Telegram\Bot\Commands\Command;

class PreciosTodasCommand extends Command
{
    protected string $name = 'precios_todas';
    protected string $description = 'Ver precios de todas tus estaciones';
    
    private PricingService $pricingService;
    private TableFormatter $formatter;

    public function __construct(
        PricingService $pricingService,
        TableFormatter $formatter
    ) {
        $this->pricingService = $pricingService;
        $this->formatter = $formatter;
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

            // Get prices for all stations
            $allPrices = $this->pricingService->getAllUserStationPrices($userId);

            if ($allPrices->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No hay precios disponibles para tus estaciones."
                ]);
                return;
            }

            // Find best prices across all stations
            $bestPrices = $this->findBestPrices($allPrices);

            // Format comprehensive response
            $response = "💰 **Precios de Todas tus Estaciones**\n\n";

            foreach ($allPrices as $stationData) {
                $station = $stationData['station'];
                $prices = $stationData['prices'];
                $priceHistory = $stationData['history'] ?? collect();

                $response .= $this->formatter->formatCompactStationPrices(
                    $station,
                    $prices,
                    $priceHistory
                );
                $response .= "\n";
            }

            // Add best prices summary
            if (!empty($bestPrices)) {
                $response .= "\n💡 **Mejores Precios:**\n";
                
                if (isset($bestPrices['regular'])) {
                    $response .= sprintf(
                        "Regular: %s ($%.2f)\n",
                        $bestPrices['regular']['alias'],
                        $bestPrices['regular']['price']
                    );
                }
                
                if (isset($bestPrices['premium'])) {
                    $response .= sprintf(
                        "Premium: %s ($%.2f)\n",
                        $bestPrices['premium']['alias'],
                        $bestPrices['premium']['price']
                    );
                }
                
                if (isset($bestPrices['diesel'])) {
                    $response .= sprintf(
                        "Diesel: %s ($%.2f)\n",
                        $bestPrices['diesel']['alias'],
                        $bestPrices['diesel']['price']
                    );
                }
            }

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown'
            ]);

        } catch (\Exception $e) {
            \Log::error('PreciosTodasCommand error', [
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

    private function findBestPrices($allPrices): array
    {
        $bestPrices = [];

        foreach ($allPrices as $stationData) {
            $station = $stationData['station'];
            $prices = $stationData['prices'];

            foreach ($prices as $priceData) {
                $fuelType = $priceData->fuel_type;
                $price = $priceData->price;

                if (!isset($bestPrices[$fuelType]) || $price < $bestPrices[$fuelType]['price']) {
                    $bestPrices[$fuelType] = [
                        'alias' => $station->alias,
                        'price' => $price
                    ];
                }
            }
        }

        return $bestPrices;
    }
}