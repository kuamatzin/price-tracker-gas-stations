<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\InlineKeyboardBuilder;
use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use Telegram\Bot\Commands\Command;

class PrecioPromedioCommand extends Command
{
    protected string $name = 'precio_promedio';

    protected string $description = 'Ver precios promedio del municipio';

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
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación.",
                ]);

                return;
            }

            // Check if we need to select a station
            if ($userStations->count() > 1) {
                cache()->put("telegram:session:{$chatId}:pending_command", 'precio_promedio', 300);

                $keyboard = $this->keyboardBuilder->buildStationSelection($userStations, 'precio_promedio');
                $this->replyWithMessage([
                    'text' => '📍 Selecciona una estación para ver promedios del municipio:',
                    'reply_markup' => $keyboard,
                ]);

                return;
            }

            // Single station or selected from callback
            $selectedStation = $userStations->first();
            $this->showMunicipalityAverages($selectedStation, $chatId);

        } catch (\Exception $e) {
            \Log::error('PrecioPromedioCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);

            $this->replyWithMessage([
                'text' => '❌ Ocurrió un error al consultar los promedios. Por favor intenta más tarde.',
            ]);
        }
    }

    private function showMunicipalityAverages($station, int $chatId): void
    {
        // Get municipality averages
        $averages = $this->pricingService->getMunicipioPriceAverages($station->municipio_id);

        // Get current station prices for comparison
        $stationPrices = $this->pricingService->getCurrentStationPrices($station->station_numero);

        $response = "📊 **Precios Promedio del Municipio**\n";
        $response .= "📍 Municipio: _{$station->municipio_nombre}_\n";
        $response .= "🏪 Tu estación: _{$station->alias}_\n\n";

        $response .= "```\n";
        $response .= "Tipo     Promedio  Tu Precio  Diferencia\n";
        $response .= "-------- --------- ---------- ----------\n";

        $fuelTypes = ['regular', 'premium', 'diesel'];

        foreach ($fuelTypes as $fuelType) {
            if (isset($averages[$fuelType])) {
                $avgPrice = $averages[$fuelType]['average'];
                $stationCount = $averages[$fuelType]['count'];

                // Find station price for this fuel type
                $stationPrice = $stationPrices->where('fuel_type', $fuelType)->first();

                if ($stationPrice) {
                    $diff = $stationPrice->price - $avgPrice;
                    $diffPercent = ($diff / $avgPrice) * 100;
                    $indicator = $diff > 0 ? '📈' : ($diff < 0 ? '📉' : '➡️');

                    $response .= sprintf(
                        "%-8s $%7.2f  $%8.2f  %+6.2f%% %s\n",
                        ucfirst($fuelType),
                        $avgPrice,
                        $stationPrice->price,
                        $diffPercent,
                        $indicator
                    );
                } else {
                    $response .= sprintf(
                        "%-8s $%7.2f  ---        ---\n",
                        ucfirst($fuelType),
                        $avgPrice
                    );
                }
            }
        }

        $response .= "```\n";

        // Add summary
        $response .= "\n📌 **Resumen:**\n";

        $hasAdvantage = false;
        $hasDisadvantage = false;

        foreach ($fuelTypes as $fuelType) {
            if (isset($averages[$fuelType])) {
                $avgPrice = $averages[$fuelType]['average'];
                $stationPrice = $stationPrices->where('fuel_type', $fuelType)->first();

                if ($stationPrice) {
                    $diff = $stationPrice->price - $avgPrice;
                    if ($diff < -0.10) {
                        $hasAdvantage = true;
                        $response .= sprintf(
                            "✅ Tu %s está $%.2f por debajo del promedio\n",
                            $fuelType,
                            abs($diff)
                        );
                    } elseif ($diff > 0.10) {
                        $hasDisadvantage = true;
                        $response .= sprintf(
                            "⚠️ Tu %s está $%.2f por encima del promedio\n",
                            $fuelType,
                            $diff
                        );
                    }
                }
            }
        }

        if (! $hasAdvantage && ! $hasDisadvantage) {
            $response .= "➡️ Tus precios están en línea con el promedio del municipio\n";
        }

        $response .= sprintf("\n_Basado en %d estaciones en el municipio_", $averages['station_count'] ?? 0);

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown',
        ]);
    }

    private function getUserId(int $chatId): int
    {
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();

        if (! $user) {
            throw new \Exception('Usuario no registrado');
        }

        return $user->id;
    }
}
