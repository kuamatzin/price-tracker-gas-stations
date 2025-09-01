<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\PricingService;
use Telegram\Bot\Commands\Command;

class RankingCommand extends Command
{
    protected string $name = 'ranking';

    protected string $description = 'Ver tu posición competitiva entre competidores';

    private AnalyticsService $analyticsService;

    private PricingService $pricingService;

    public function __construct(
        AnalyticsService $analyticsService,
        PricingService $pricingService
    ) {
        $this->analyticsService = $analyticsService;
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

        // Parse arguments for station alias and radius
        $stationAlias = null;
        $radiusKm = 5; // Default 5km radius

        foreach ($arguments as $arg) {
            if (is_numeric($arg) && $arg > 0 && $arg <= 20) {
                $radiusKm = (float) $arg;
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

            // Get competitor ranking
            $ranking = $this->analyticsService->getCompetitorRanking(
                $selectedStation->station_numero,
                $radiusKm
            );

            if (empty($ranking['rankings'])) {
                $this->replyWithMessage([
                    'text' => '❌ No hay suficientes datos de competidores para generar el ranking.',
                ]);

                return;
            }

            // Format response
            $response = $this->formatResponse(
                $selectedStation,
                $ranking['rankings'],
                $radiusKm
            );

            $this->replyWithMessage([
                'text' => $response,
                'parse_mode' => 'Markdown',
            ]);

        } catch (\Exception $e) {
            \Log::error('RankingCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->replyWithMessage([
                'text' => '❌ Ocurrió un error al calcular el ranking. Por favor intenta más tarde.',
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

    private function formatResponse($station, array $rankings, float $radiusKm): string
    {
        $stationName = $station->alias ?? $station->station_name;

        $response = "🏆 *Tu Posición Competitiva*\n";
        $response .= "📍 Estación: {$stationName}\n";
        $response .= "📏 Radio: {$radiusKm}km\n\n";

        if (empty($rankings)) {
            return $response.'No hay datos de ranking disponibles.';
        }

        // Process each fuel type
        foreach ($rankings as $fuelType => $data) {
            $response .= $this->formatFuelTypeRanking($fuelType, $data);
        }

        // Add overall recommendation
        $response .= "\n💡 *Recomendación General:*\n";
        $response .= $this->generateOverallRecommendation($rankings);

        return $response;
    }

    private function formatFuelTypeRanking(string $fuelType, array $data): string
    {
        $fuelName = ucfirst($fuelType);
        $position = $data['position'];
        $total = $data['total_competitors'];
        $percentile = $data['percentile'];
        $yourPrice = $data['your_price'];
        $avgPrice = $data['market_average'];
        $priceDiff = $data['price_difference_from_avg'];
        $priceDiffPercent = $data['price_difference_percentage'];

        // Determine position quality
        $positionEmoji = $this->getPositionEmoji($percentile);

        $response = "*{$fuelName}:* #{$position} de {$total} {$positionEmoji}\n";
        $response .= '  Tu precio: $'.number_format($yourPrice, 2)."\n";
        $response .= '  Promedio: $'.number_format($avgPrice, 2)."\n";

        if ($priceDiff != 0) {
            $sign = $priceDiff > 0 ? '+' : '';
            $response .= "  Diferencia: {$sign}$".number_format($priceDiff, 2);
            $response .= " ({$sign}".number_format($priceDiffPercent, 1)."%)\n";
        }

        // Show top competitors if not in top 3
        if ($position > 3 && ! empty($data['top_competitors'])) {
            $response .= "  *Top 3:*\n";
            foreach ($data['top_competitors'] as $competitor) {
                $mark = $competitor['is_target'] ?? false ? ' ← Tú' : '';
                $response .= "    {$competitor['position']}. {$competitor['brand']} - $";
                $response .= number_format($competitor['price'], 2).$mark."\n";
            }
        }

        // Add specific recommendation
        if (! empty($data['recommendation'])) {
            $response .= "  💡 {$data['recommendation']}\n";
        }

        $response .= "\n";

        return $response;
    }

    private function getPositionEmoji(int $percentile): string
    {
        if ($percentile >= 75) {
            return '✅ (Top 25%)';
        } elseif ($percentile >= 50) {
            return '👍 (Top 50%)';
        } elseif ($percentile >= 25) {
            return '⚠️ (Bottom 50%)';
        } else {
            return '❌ (Bottom 25%)';
        }
    }

    private function generateOverallRecommendation(array $rankings): string
    {
        $totalPercentile = 0;
        $count = 0;
        $weakFuels = [];
        $strongFuels = [];

        foreach ($rankings as $fuelType => $data) {
            $percentile = $data['percentile'];
            $totalPercentile += $percentile;
            $count++;

            if ($percentile < 50) {
                $weakFuels[] = ucfirst($fuelType);
            } elseif ($percentile >= 75) {
                $strongFuels[] = ucfirst($fuelType);
            }
        }

        $avgPercentile = $count > 0 ? $totalPercentile / $count : 0;

        if ($avgPercentile >= 75) {
            return '🎯 Excelente posición competitiva general. Mantén tu estrategia actual y monitorea cambios del mercado.';
        } elseif ($avgPercentile >= 50) {
            if (! empty($weakFuels)) {
                return '📊 Posición competitiva media. Enfócate en mejorar: '.implode(', ', $weakFuels).'.';
            } else {
                return '📊 Posición competitiva balanceada. Considera ajustes graduales para mejorar tu ranking.';
            }
        } else {
            return '⚠️ Necesitas mejorar tu competitividad. Revisa precios de '.
                   (! empty($weakFuels) ? implode(' y ', $weakFuels) : 'todos los combustibles').
                   ' para recuperar participación de mercado.';
        }
    }
}
