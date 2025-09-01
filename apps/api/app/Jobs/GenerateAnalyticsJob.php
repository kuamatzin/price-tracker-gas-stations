<?php

namespace App\Jobs;

use App\Repositories\AnalyticsRepository;
use App\Services\Telegram\AnalyticsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

/**
 * Generate Analytics Job
 *
 * Background job for pre-generating and caching analytics data
 * to improve response times for user queries.
 */
class GenerateAnalyticsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries;

    public $backoff;

    private string $stationNumero;

    private array $analyticsTypes;

    /**
     * Create a new job instance.
     */
    public function __construct(string $stationNumero, array $analyticsTypes = ['trends', 'ranking'])
    {
        $this->stationNumero = $stationNumero;
        $this->analyticsTypes = $analyticsTypes;
        $this->tries = Config::get('analytics.retry.max_attempts');
        $this->backoff = Config::get('analytics.retry.backoff_seconds');
        $this->onQueue(Config::get('analytics.queues.analytics_queue'));
    }

    /**
     * Execute the job.
     */
    public function handle(
        AnalyticsService $analyticsService,
        AnalyticsRepository $analyticsRepository
    ): void {
        try {
            Log::info('GenerateAnalyticsJob started', [
                'station_numero' => $this->stationNumero,
                'types' => $this->analyticsTypes,
            ]);

            $station = \App\Models\Station::where('numero', $this->stationNumero)->first();

            if (! $station) {
                Log::warning('Station not found for analytics generation', [
                    'station_numero' => $this->stationNumero,
                ]);

                return;
            }

            // Generate each type of analytics
            foreach ($this->analyticsTypes as $type) {
                switch ($type) {
                    case 'trends':
                        $this->generateTrendAnalytics($station, $analyticsService);
                        break;

                    case 'ranking':
                        $this->generateRankingAnalytics($station, $analyticsService);
                        break;

                    case 'history':
                        $this->generateHistoryAnalytics($station, $analyticsService);
                        break;

                    case 'volatility':
                        $this->generateVolatilityAnalytics($station, $analyticsRepository);
                        break;
                }
            }

            Log::info('Analytics generated and cached', [
                'station_numero' => $this->stationNumero,
                'types' => $this->analyticsTypes,
            ]);

        } catch (\Exception $e) {
            Log::error('GenerateAnalyticsJob failed', [
                'station_numero' => $this->stationNumero,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e; // Re-throw for retry mechanism
        }
    }

    /**
     * Generate and cache trend analytics
     */
    private function generateTrendAnalytics($station, AnalyticsService $analyticsService): void
    {
        // Generate for different time periods
        $timePeriods = Config::get('analytics.time_periods');
        $defaultRadius = Config::get('analytics.radius.default');

        foreach ($timePeriods as $periodName => $days) {
            $trends = $analyticsService->getPriceTrends(
                $station->numero,
                $days,
                $defaultRadius
            );

            // Cache will be handled inside getPriceTrends method
            // This just ensures the cache is warm
        }
    }

    /**
     * Generate and cache ranking analytics
     */
    private function generateRankingAnalytics($station, AnalyticsService $analyticsService): void
    {
        // Generate for different radius values
        $radiusValues = [
            Config::get('analytics.radius.small'),
            Config::get('analytics.radius.medium'),
            Config::get('analytics.radius.large'),
        ];

        foreach ($radiusValues as $radiusKm) {
            $ranking = $analyticsService->getCompetitorRanking(
                $station->numero,
                $radiusKm
            );

            // Cache will be handled inside getCompetitorRanking method
        }
    }

    /**
     * Generate and cache history analytics
     */
    private function generateHistoryAnalytics($station, AnalyticsService $analyticsService): void
    {
        // Generate for different time periods and fuel types
        $periods = Config::get('analytics.time_periods');
        $fuelTypes = array_merge(Config::get('analytics.fuel_types'), [null]); // null for all

        foreach ($periods as $periodName => $days) {
            foreach ($fuelTypes as $fuelType) {
                $history = $analyticsService->getPriceHistory(
                    $station->numero,
                    $days,
                    $fuelType
                );

                // Cache will be handled inside getPriceHistory method
            }
        }
    }

    /**
     * Generate and cache volatility analytics
     */
    private function generateVolatilityAnalytics($station, AnalyticsRepository $analyticsRepository): void
    {
        // Get nearby stations for volatility comparison
        $nearbyStations = \App\Models\Station::select('numero')
            ->where('is_active', true)
            ->whereRaw('(6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
                       cos(radians(lng) - radians(?)) + sin(radians(?)) * 
                       sin(radians(lat)))) <= ?',
                [$station->lat, $station->lng, $station->lat, Config::get('analytics.radius.default')])
            ->pluck('numero')
            ->toArray();

        $volatility = $analyticsRepository->getVolatilityMetrics($nearbyStations, 30);

        // Cache volatility metrics
        $cacheKey = "analytics:volatility:{$station->numero}:30";
        $cacheTtl = Config::get('analytics.cache.volatility_ttl');
        Cache::put($cacheKey, $volatility, $cacheTtl);

        // Also generate market share estimation
        $marketShare = $analyticsRepository->estimateMarketShare(
            $station->numero,
            array_diff($nearbyStations, [$station->numero])
        );

        $cacheKey = "analytics:market_share:{$station->numero}";
        $cacheTtl = Config::get('analytics.cache.volatility_ttl');
        Cache::put($cacheKey, $marketShare, $cacheTtl);
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('GenerateAnalyticsJob permanently failed', [
            'station_numero' => $this->stationNumero,
            'types' => $this->analyticsTypes,
            'error' => $exception->getMessage(),
        ]);
    }
}
