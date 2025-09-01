<?php

namespace App\Telegram\Commands;

use App\Services\External\DeepSeekService;
use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\PricingService;
use App\Jobs\GenerateRecommendationsJob;
use Telegram\Bot\Commands\Command;
use Illuminate\Support\Facades\Cache;

class RecomendacionCommand extends Command
{
    protected string $name = 'recomendacion';
    protected string $description = 'Obtener recomendaciones de precio basadas en IA';
    
    private DeepSeekService $deepSeekService;
    private AnalyticsService $analyticsService;
    private PricingService $pricingService;

    public function __construct(
        DeepSeekService $deepSeekService,
        AnalyticsService $analyticsService,
        PricingService $pricingService
    ) {
        $this->deepSeekService = $deepSeekService;
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
                'text' => "❌ Usuario no registrado. Usa /start para registrarte."
            ]);
            return;
        }
        
        $arguments = $this->getArguments();
        $stationAlias = null;
        
        foreach ($arguments as $arg) {
            if (!in_array(strtolower($arg), ['regular', 'premium', 'diesel'])) {
                $stationAlias = $arg;
            }
        }

        try {
            // Send typing action
            $this->telegram->sendChatAction([
                'chat_id' => $chatId,
                'action' => 'typing'
            ]);

            $userStations = $this->pricingService->getUserStations($userId);

            if ($userStations->isEmpty()) {
                $this->replyWithMessage([
                    'text' => "❌ No tienes estaciones registradas.\n\nUsa /registrar para agregar tu primera estación."
                ]);
                return;
            }

            // Determine which station to use
            $selectedStation = $this->selectStation($userStations, $stationAlias);
            
            if (!$selectedStation) {
                if ($stationAlias) {
                    $this->replyWithMessage([
                        'text' => "❌ No encontré la estación '$stationAlias'.\n\n" .
                                 "Tus estaciones: " . $userStations->pluck('alias')->implode(', ')
                    ]);
                } else {
                    $this->replyWithMessage([
                        'text' => "❌ No se pudo determinar la estación. Especifica un alias."
                    ]);
                }
                return;
            }

            // Check cache first
            $cacheKey = "telegram:recommendation:{$selectedStation->station_numero}";
            $cachedRecommendation = Cache::get($cacheKey);
            
            if ($cachedRecommendation) {
                $this->sendRecommendation($cachedRecommendation, $selectedStation, true);
                return;
            }

            // Send initial message while processing
            $this->replyWithMessage([
                'text' => "🤖 Analizando datos del mercado...\nEsto puede tomar unos segundos.",
                'parse_mode' => 'Markdown'
            ]);

            // Gather market data for AI analysis
            $marketData = $this->gatherMarketData($selectedStation);

            // Generate AI recommendation
            $recommendation = $this->deepSeekService->generatePricingRecommendation($marketData);

            // Cache the recommendation
            Cache::put($cacheKey, $recommendation, 1800); // 30 minutes

            // Send the recommendation
            $this->sendRecommendation($recommendation, $selectedStation, false);

            // Queue for pre-generation of future recommendations
            GenerateRecommendationsJob::dispatch($selectedStation->station_numero)
                ->delay(now()->addMinutes(25)); // Pre-generate before cache expires

        } catch (\Exception $e) {
            \Log::error('RecomendacionCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al generar la recomendación. Por favor intenta más tarde."
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

    private function gatherMarketData($station): array
    {
        // Get current prices
        $currentPrices = $this->pricingService->getCurrentStationPrices($station->station_numero);
        
        $prices = [];
        foreach ($currentPrices as $price) {
            $prices[$price->fuel_type] = $price->price;
        }

        // Get trends
        $trends = $this->analyticsService->getPriceTrends(
            $station->station_numero,
            7,
            5
        );

        // Get ranking
        $ranking = $this->analyticsService->getCompetitorRanking(
            $station->station_numero,
            5
        );

        // Get nearby competitors
        $competitors = $this->pricingService->getNearbyCompetitorPrices(
            $station->lat,
            $station->lng,
            5,
            $station->station_numero
        );

        // Calculate market averages
        $marketAverage = [];
        foreach (['regular', 'premium', 'diesel'] as $fuelType) {
            $fuelPrices = $competitors->pluck($fuelType . '_price')->filter()->values();
            if ($fuelPrices->isNotEmpty()) {
                $marketAverage[$fuelType] = round($fuelPrices->avg(), 2);
            }
        }

        // Determine overall trend
        $overallTrend = 'estable';
        if (!empty($trends['trends'])) {
            $risingCount = 0;
            $fallingCount = 0;
            foreach ($trends['trends'] as $fuel => $data) {
                if ($data['trend_direction'] === 'rising') $risingCount++;
                if ($data['trend_direction'] === 'falling') $fallingCount++;
            }
            if ($risingCount > $fallingCount) {
                $overallTrend = 'alcista';
            } elseif ($fallingCount > $risingCount) {
                $overallTrend = 'bajista';
            }
        }

        // Build market data array
        return [
            'current_prices' => $prices,
            'market_average' => $marketAverage,
            'trend' => $overallTrend,
            'ranking' => !empty($ranking['rankings']) ? array_map(function($r) {
                return [
                    'position' => $r['position'],
                    'total' => $r['total_competitors']
                ];
            }, $ranking['rankings']) : [],
            'competitor_count' => $competitors->count()
        ];
    }

    private function sendRecommendation(array $recommendation, $station, bool $isCached): void
    {
        $stationName = $station->alias ?? $station->station_name;
        
        $response = "🤖 *Recomendación de Precio con IA*\n";
        $response .= "📍 Estación: {$stationName}\n\n";

        // Main recommendation
        $response .= "💡 *Recomendación:*\n";
        $response .= $recommendation['recommendation'] . "\n\n";

        // Suggested actions
        if (!empty($recommendation['suggested_actions'])) {
            $response .= "📋 *Acciones Sugeridas:*\n";
            foreach ($recommendation['suggested_actions'] as $index => $action) {
                $response .= ($index + 1) . ". " . $action . "\n";
            }
            $response .= "\n";
        }

        // Risk level
        if (isset($recommendation['risk_level'])) {
            $riskEmoji = $this->getRiskEmoji($recommendation['risk_level']);
            $riskLabel = $this->getRiskLabel($recommendation['risk_level']);
            $response .= "⚠️ *Nivel de Riesgo:* {$riskEmoji} {$riskLabel}\n";
        }

        // Confidence level
        if (isset($recommendation['confidence'])) {
            $confidence = round($recommendation['confidence'] * 100);
            $response .= "📊 *Confianza:* {$confidence}%\n";
        }

        // Reasoning (if provided)
        if (!empty($recommendation['reasoning'])) {
            $response .= "\n💭 *Razonamiento:*\n";
            $response .= "_" . $recommendation['reasoning'] . "_\n";
        }

        // Add footer
        $response .= "\n";
        if ($isCached) {
            $response .= "⏱️ _Recomendación generada recientemente_\n";
        }
        
        if (isset($recommendation['ai_generated']) && !$recommendation['ai_generated']) {
            $response .= "ℹ️ _Recomendación basada en mejores prácticas_\n";
        } else {
            $response .= "🤖 _Powered by DeepSeek AI_\n";
        }

        $response .= "🔄 _Actualiza en 30 minutos para nueva recomendación_";

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    private function getRiskEmoji(string $riskLevel): string
    {
        switch ($riskLevel) {
            case 'low':
                return '🟢';
            case 'medium':
                return '🟡';
            case 'high':
                return '🔴';
            default:
                return '⚪';
        }
    }

    private function getRiskLabel(string $riskLevel): string
    {
        switch ($riskLevel) {
            case 'low':
                return 'Bajo';
            case 'medium':
                return 'Medio';
            case 'high':
                return 'Alto';
            default:
                return 'Desconocido';
        }
    }
}