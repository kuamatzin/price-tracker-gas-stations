<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\PricingService;
use App\Services\Telegram\SparklineGenerator;
use Telegram\Bot\Commands\Command;

class TendenciaCommand extends Command
{
    protected string $name = 'tendencia';

    protected string $description = 'Ver tendencia de precios de los últimos 7 días';

    private AnalyticsService $analyticsService;

    private SparklineGenerator $sparklineGenerator;

    private PricingService $pricingService;

    public function __construct(
        AnalyticsService $analyticsService,
        SparklineGenerator $sparklineGenerator,
        PricingService $pricingService
    ) {
        $this->analyticsService = $analyticsService;
        $this->sparklineGenerator = $sparklineGenerator;
        $this->pricingService = $pricingService;
    }

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();

        try {
            $userId = $this->getUserId($chatId);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => '❌ Usuario no registrado. Usa /start para registrarte.',
            ]);

            return;
        }

        $arguments = $this->getArguments();

        // Parse arguments for station alias and fuel type filter
        $stationAlias = null;
        $fuelTypeFilter = null;
        $days = 7; // Default to 7 days

        foreach ($arguments as $arg) {
            $lowerArg = strtolower($arg);
            if (in_array($lowerArg, ['regular', 'premium', 'diesel'])) {
                $fuelTypeFilter = $lowerArg;
            } elseif (is_numeric($arg) && $arg > 0 && $arg <= 30) {
                $days = (int) $arg;
            } else {
                $stationAlias = $arg;
            }
        }

        try {
            // Send typing action
            $this->telegram->sendChatAction([
                'chat_id' => $chatId,
                'action' => 'typing',
            ]);

            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación.",
                ]);

                return;
            }

            // Determine which station to use
            $selectedStation = $this->selectStation($userStations, $stationAlias);

            if (! $selectedStation) {
                if ($stationAlias) {
                    $this->replyWithMessage([
                        'text' => "❌ No encontré la estación '$stationAlias'.\n\n".
                                 'Tus estaciones: '.$userStations->pluck('alias')->implode(', '),
                    ]);
                } else {
                    $this->replyWithMessage([
                        'text' => '❌ No se pudo determinar la estación. Especifica un alias.',
                    ]);
                }

                return;
            }

            // Get price trends
            $trends = $this->analyticsService->getPriceTrends(
                $selectedStation->station_numero,
                $days,
                5 // 5km radius
            );

            if (empty($trends['trends'])) {
                $this->replyWithMessage([
                    'text' => '❌ No hay suficientes datos para mostrar tendencias.',
                ]);

                return;
            }

            // Generate sparklines for each fuel type
            $sparklines = [];
            $insights = [];

            foreach ($trends['trends'] as $fuelType => $trendData) {
                if ($fuelTypeFilter && $fuelType !== $fuelTypeFilter) {
                    continue;
                }

                $prices = array_column($trendData['daily_prices'], 'avg_price');

                if (! empty($prices)) {
                    $sparklines[$fuelType] = $this->sparklineGenerator->generate(
                        $prices,
                        ucfirst($fuelType),
                        true,
                        true
                    );

                    // Generate insight based on trend
                    $insights[$fuelType] = $this->generateInsight(
                        $fuelType,
                        $trendData['trend_direction'],
                        $trendData['change_percentage'],
                        $trendData['statistics']
                    );
                }
            }

            // Format response
            $response = $this->formatResponse(
                $selectedStation,
                $sparklines,
                $insights,
                $days,
                $trends['area_radius_km']
            );

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown',
            ]);

        } catch (\Exception $e) {
            \Log::error('TendenciaCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->replyWithMessage([
                'text' => '❌ Ocurrió un error al analizar las tendencias. Por favor intenta más tarde.',
            ]);
        }
    }

    private function getUserId(int $chatId): int
    {
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();

        if (! $user) {
            throw new \Exception('Usuario no registrado');
        }

        return $user->id;
    }

    private function selectStation($userStations, $stationAlias)
    {
        if ($stationAlias) {
            return $userStations->firstWhere('alias', $stationAlias);
        }

        if ($userStations->count() === 1) {
            return $userStations->first();
        }

        return $userStations->firstWhere('is_default', true);
    }

    private function generateInsight(
        string $fuelType,
        string $trendDirection,
        float $changePercentage,
        array $statistics
    ): string {
        $fuelName = ucfirst($fuelType);
        $absChange = abs($changePercentage);

        if ($trendDirection === 'rising') {
            if ($absChange > 3) {
                return "⚠️ {$fuelName} en alza fuerte (+{$absChange}%). Considera ajustar precios pronto.";
            } elseif ($absChange > 1) {
                return "📈 {$fuelName} subiendo gradualmente. Monitorea competidores.";
            } else {
                return "➡️ {$fuelName} con ligera alza. Mantén vigilancia.";
            }
        } elseif ($trendDirection === 'falling') {
            if ($absChange > 3) {
                return "📉 {$fuelName} bajando rápidamente (-{$absChange}%). Oportunidad para ajustar.";
            } elseif ($absChange > 1) {
                return "↘️ {$fuelName} en descenso gradual. Evalúa tu margen.";
            } else {
                return "➡️ {$fuelName} con ligera baja. Situación favorable.";
            }
        } else {
            if ($statistics['std_deviation'] > 0.5) {
                return "〰️ {$fuelName} volátil pero estable. Alta variación en el área.";
            } else {
                return "➡️ {$fuelName} estable. Mercado sin cambios significativos.";
            }
        }
    }

    private function formatResponse(
        $station,
        array $sparklines,
        array $insights,
        int $days,
        float $radiusKm
    ): string {
        $stationName = $station->alias ?? $station->station_name;

        $response = "📊 *Tendencia de Precios - Últimos {$days} días*\n";
        $response .= "📍 Estación: {$stationName}\n";
        $response .= "🗺️ Área: {$radiusKm}km de radio\n\n";

        if (empty($sparklines)) {
            return $response.'No hay datos disponibles para el período seleccionado.';
        }

        // Add sparklines
        foreach ($sparklines as $fuelType => $sparkline) {
            $response .= "`{$sparkline}`\n";
        }

        $response .= "\n💡 *Análisis:*\n";

        // Add insights
        foreach ($insights as $fuelType => $insight) {
            $response .= "{$insight}\n";
        }

        // Add general recommendation
        $response .= "\n📌 *Recomendación General:*\n";
        $response .= $this->generateGeneralRecommendation($insights);

        return $response;
    }

    private function generateGeneralRecommendation(array $insights): string
    {
        $risingCount = 0;
        $fallingCount = 0;

        foreach ($insights as $insight) {
            if (strpos($insight, 'alza') !== false || strpos($insight, 'subiendo') !== false) {
                $risingCount++;
            } elseif (strpos($insight, 'baja') !== false || strpos($insight, 'descenso') !== false) {
                $fallingCount++;
            }
        }

        if ($risingCount > $fallingCount) {
            return 'Mercado en tendencia alcista. Evalúa ajustar precios para mantener márgenes.';
        } elseif ($fallingCount > $risingCount) {
            return 'Mercado a la baja. Oportunidad para ganar participación con precios competitivos.';
        } else {
            return 'Mercado estable. Mantén tu estrategia actual y monitorea cambios.';
        }
    }
}
