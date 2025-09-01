<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use Carbon\Carbon;
use Telegram\Bot\Commands\Command;

class HistorialCommand extends Command
{
    protected string $name = 'historial';

    protected string $description = 'Ver historial de precios de tu estación';

    private AnalyticsService $analyticsService;

    private PricingService $pricingService;

    private TableFormatter $tableFormatter;

    public function __construct(
        AnalyticsService $analyticsService,
        PricingService $pricingService,
        TableFormatter $tableFormatter
    ) {
        $this->analyticsService = $analyticsService;
        $this->pricingService = $pricingService;
        $this->tableFormatter = $tableFormatter;
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

        // Parse arguments
        $stationAlias = null;
        $days = 7; // Default
        $fuelType = null;

        foreach ($arguments as $arg) {
            $lowerArg = strtolower($arg);
            if (in_array($lowerArg, ['regular', 'premium', 'diesel'])) {
                $fuelType = $lowerArg;
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

            // Get price history
            $history = $this->analyticsService->getPriceHistory(
                $selectedStation->station_numero,
                $days,
                $fuelType
            );

            if (empty($history['history'])) {
                $this->replyWithMessage([
                    'text' => '❌ No hay historial de precios disponible para el período seleccionado.',
                ]);

                return;
            }

            // Format and send response
            $response = $this->formatHistoryResponse(
                $selectedStation,
                $history,
                $days,
                $fuelType
            );

            // Split response if too long
            $chunks = $this->splitLongMessage($response);
            foreach ($chunks as $chunk) {
                $this->replyWithMessage([
                    'text' => $chunk,
                    'parse_mode' => 'Markdown',
                ]);
            }

        } catch (\Exception $e) {
            \Log::error('HistorialCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->replyWithMessage([
                'text' => '❌ Ocurrió un error al consultar el historial. Por favor intenta más tarde.',
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

    private function formatHistoryResponse($station, array $history, int $days, ?string $fuelType): string
    {
        $stationName = $station->alias ?? $station->station_name;

        $response = "📊 *Historial de Precios*\n";
        $response .= "📍 Estación: {$stationName}\n";
        $response .= "📅 Período: Últimos {$days} días\n";

        if ($fuelType) {
            $response .= '⛽ Combustible: '.ucfirst($fuelType)."\n";
        }

        $response .= "\n";

        // Process each fuel type
        foreach ($history['history'] as $fuel => $fuelHistory) {
            if ($fuelType && $fuel !== $fuelType) {
                continue;
            }

            $response .= '*'.ucfirst($fuel)."*\n";
            $response .= "```\n";

            // Create table header
            $response .= "Fecha       | Precio | Cambio\n";
            $response .= "------------|--------|-------\n";

            // Process daily history
            $previousPrice = null;
            foreach ($fuelHistory['daily_history'] as $day) {
                $date = Carbon::parse($day['date'])->format('d/m');
                $price = $day['avg_price'] ?? $day['last_price'];

                $change = '';
                if ($previousPrice !== null) {
                    $diff = $price - $previousPrice;
                    if (abs($diff) > 0.01) {
                        $sign = $diff > 0 ? '+' : '';
                        $change = sprintf('%s%.2f', $sign, $diff);
                    } else {
                        $change = '=';
                    }
                }

                $response .= sprintf(
                    "%-11s | $%-5.2f | %-6s\n",
                    $date,
                    $price,
                    $change
                );

                $previousPrice = $price;
            }

            $response .= "```\n";

            // Add statistics
            $stats = $fuelHistory['statistics'];
            $response .= $this->formatStatistics($stats, $fuelHistory['total_changes']);

            // Add trend insight
            $response .= $this->generateHistoryInsight(
                $fuel,
                $fuelHistory['trend_direction'],
                $stats,
                $fuelHistory['total_changes'],
                $days
            );

            $response .= "\n";
        }

        // Add summary
        $response .= $this->generateHistorySummary($history['history'], $days);

        return $response;
    }

    private function formatStatistics(array $stats, int $totalChanges): string
    {
        $response = "📈 *Estadísticas:*\n";
        $response .= sprintf("• Promedio: $%.2f\n", $stats['average']);
        $response .= sprintf("• Mediana: $%.2f\n", $stats['median']);
        $response .= sprintf("• Mínimo: $%.2f\n", $stats['min']);
        $response .= sprintf("• Máximo: $%.2f\n", $stats['max']);
        $response .= sprintf("• Desv. Est.: $%.2f\n", $stats['std_deviation']);
        $response .= sprintf("• Cambios: %d\n", $totalChanges);

        return $response;
    }

    private function generateHistoryInsight(
        string $fuelType,
        string $trendDirection,
        array $stats,
        int $totalChanges,
        int $days
    ): string {
        $response = "\n💡 *Análisis:* ";

        $avgChangesPerDay = $totalChanges / $days;
        $volatility = $stats['std_deviation'] / $stats['average'] * 100;

        if ($trendDirection === 'rising') {
            $response .= 'Tendencia alcista. ';
        } elseif ($trendDirection === 'falling') {
            $response .= 'Tendencia bajista. ';
        } else {
            $response .= 'Precio estable. ';
        }

        if ($volatility > 5) {
            $response .= sprintf('Alta volatilidad (%.1f%%). ', $volatility);
        } elseif ($volatility > 2) {
            $response .= sprintf('Volatilidad moderada (%.1f%%). ', $volatility);
        } else {
            $response .= 'Baja volatilidad. ';
        }

        if ($avgChangesPerDay > 1) {
            $response .= 'Cambios frecuentes detectados.';
        } elseif ($avgChangesPerDay < 0.5) {
            $response .= 'Pocos cambios en el período.';
        }

        return $response."\n";
    }

    private function generateHistorySummary(array $historyData, int $days): string
    {
        $response = "📌 *Resumen General:*\n";

        $trends = [];
        $totalVolatility = 0;
        $count = 0;

        foreach ($historyData as $fuel => $data) {
            $trends[$fuel] = $data['trend_direction'];
            $volatility = $data['statistics']['std_deviation'] / $data['statistics']['average'] * 100;
            $totalVolatility += $volatility;
            $count++;
        }

        $avgVolatility = $count > 0 ? $totalVolatility / $count : 0;

        // Determine overall market condition
        if ($avgVolatility > 5) {
            $response .= "⚠️ Mercado volátil - considera ajustes frecuentes.\n";
        } elseif ($avgVolatility > 2) {
            $response .= "📊 Mercado con movimiento moderado.\n";
        } else {
            $response .= "✅ Mercado estable - mantén estrategia actual.\n";
        }

        // Trend summary
        $risingCount = count(array_filter($trends, fn ($t) => $t === 'rising'));
        $fallingCount = count(array_filter($trends, fn ($t) => $t === 'falling'));

        if ($risingCount > $fallingCount) {
            $response .= "📈 Tendencia general: Alcista\n";
        } elseif ($fallingCount > $risingCount) {
            $response .= "📉 Tendencia general: Bajista\n";
        } else {
            $response .= "➡️ Tendencia general: Lateral\n";
        }

        return $response;
    }

    private function splitLongMessage(string $message, int $maxLength = 4000): array
    {
        if (strlen($message) <= $maxLength) {
            return [$message];
        }

        $chunks = [];
        $lines = explode("\n", $message);
        $currentChunk = '';

        foreach ($lines as $line) {
            if (strlen($currentChunk."\n".$line) > $maxLength) {
                if ($currentChunk) {
                    $chunks[] = $currentChunk;
                    $currentChunk = $line;
                } else {
                    // Single line is too long, split it
                    $chunks[] = substr($line, 0, $maxLength);
                    $currentChunk = substr($line, $maxLength);
                }
            } else {
                $currentChunk .= ($currentChunk ? "\n" : '').$line;
            }
        }

        if ($currentChunk) {
            $chunks[] = $currentChunk;
        }

        return $chunks;
    }
}
