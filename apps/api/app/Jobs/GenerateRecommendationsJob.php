<?php

namespace App\Jobs;

use App\Services\External\DeepSeekService;
use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\PricingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

/**
 * Generate Recommendations Job
 * 
 * Background job for generating AI-powered pricing recommendations
 * based on market analytics and competitive positioning.
 */
class GenerateRecommendationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries;
    public $backoff;
    
    private string $stationNumero;

    /**
     * Create a new job instance.
     */
    public function __construct(string $stationNumero)
    {
        $this->stationNumero = $stationNumero;
        $this->tries = Config::get('analytics.retry.max_attempts');
        $this->backoff = Config::get('analytics.retry.backoff_seconds');
        $this->onQueue(Config::get('analytics.queues.recommendation_queue'));
    }

    /**
     * Execute the job.
     */
    public function handle(
        DeepSeekService $deepSeekService,
        AnalyticsService $analyticsService,
        PricingService $pricingService
    ): void {
        try {
            Log::info('GenerateRecommendationsJob started', [
                'station_numero' => $this->stationNumero
            ]);

            $station = \App\Models\Station::where('numero', $this->stationNumero)->first();
            
            if (!$station) {
                Log::warning('Station not found for recommendation generation', [
                    'station_numero' => $this->stationNumero
                ]);
                return;
            }

            // Gather market data
            $marketData = $this->gatherMarketData(
                $station,
                $analyticsService,
                $pricingService
            );

            // Generate AI recommendation
            $recommendation = $deepSeekService->generatePricingRecommendation($marketData);

            // Cache the recommendation
            $cacheKey = "telegram:recommendation:{$this->stationNumero}";
            $cacheTtl = Config::get('analytics.cache.recommendation_ttl');
            Cache::put($cacheKey, $recommendation, $cacheTtl);

            Log::info('Recommendation generated and cached', [
                'station_numero' => $this->stationNumero,
                'ai_generated' => $recommendation['ai_generated'] ?? false
            ]);

        } catch (\Exception $e) {
            Log::error('GenerateRecommendationsJob failed', [
                'station_numero' => $this->stationNumero,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw $e; // Re-throw for retry mechanism
        }
    }

    /**
     * Gather market data for AI analysis
     */
    private function gatherMarketData(
        $station,
        AnalyticsService $analyticsService,
        PricingService $pricingService
    ): array {
        // Get current prices
        $currentPrices = $pricingService->getCurrentStationPrices($station->numero);
        
        $prices = [];
        foreach ($currentPrices as $price) {
            $prices[$price->fuel_type] = $price->price;
        }

        // Get trends
        $defaultRadius = Config::get('analytics.radius.default');
        $shortPeriod = Config::get('analytics.time_periods.short');
        
        $trends = $analyticsService->getPriceTrends(
            $station->numero,
            $shortPeriod,
            $defaultRadius
        );

        // Get ranking
        $ranking = $analyticsService->getCompetitorRanking(
            $station->numero,
            $defaultRadius
        );

        // Get nearby competitors
        $competitors = $pricingService->getNearbyCompetitorPrices(
            $station->lat,
            $station->lng,
            $defaultRadius,
            $station->numero
        );

        // Calculate market averages
        $marketAverage = [];
        $fuelTypes = Config::get('analytics.fuel_types');
        
        foreach ($fuelTypes as $fuelType) {
            $fuelPrices = $competitors->pluck($fuelType . '_price')->filter()->values();
            if ($fuelPrices->isNotEmpty()) {
                $marketAverage[$fuelType] = round($fuelPrices->avg(), 2);
            }
        }

        // Determine overall trend
        $overallTrend = $this->determineOverallTrend($trends);

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
            'competitor_count' => $competitors->count(),
            'station_info' => [
                'nombre' => $station->nombre,
                'brand' => $station->brand,
                'municipio_id' => $station->municipio_id
            ]
        ];
    }

    /**
     * Determine overall market trend
     */
    private function determineOverallTrend(array $trends): string
    {
        if (empty($trends['trends'])) {
            return 'estable';
        }

        $risingCount = 0;
        $fallingCount = 0;
        
        foreach ($trends['trends'] as $fuel => $data) {
            if ($data['trend_direction'] === 'rising') {
                $risingCount++;
            } elseif ($data['trend_direction'] === 'falling') {
                $fallingCount++;
            }
        }
        
        if ($risingCount > $fallingCount) {
            return 'alcista';
        } elseif ($fallingCount > $risingCount) {
            return 'bajista';
        }
        
        return 'estable';
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('GenerateRecommendationsJob permanently failed', [
            'station_numero' => $this->stationNumero,
            'error' => $exception->getMessage()
        ]);

        // Cache a fallback recommendation
        $cacheKey = "telegram:recommendation:{$this->stationNumero}";
        Cache::put($cacheKey, [
            'recommendation' => 'Mantén tus precios actuales y monitorea el mercado. Sistema de recomendaciones temporalmente no disponible.',
            'suggested_actions' => [
                'Revisar precios de competidores manualmente',
                'Monitorear tendencias del mercado',
                'Ajustar precios según demanda local'
            ],
            'risk_level' => 'medium',
            'confidence' => 0.3,
            'reasoning' => 'Recomendación basada en mejores prácticas (sistema AI no disponible)',
            'ai_generated' => false
        ], 900); // 15 minutes for fallback
    }
}