<?php

namespace App\Services\Telegram;

use App\Contracts\AnalyticsServiceInterface;
use App\Repositories\PriceRepository;
use App\Repositories\StationRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * Analytics Service Implementation
 * 
 * Provides comprehensive analytics for gas station pricing including
 * trend analysis, competitor ranking, and historical data analysis.
 */
class AnalyticsService implements AnalyticsServiceInterface
{
    private PriceRepository $priceRepository;
    private StationRepository $stationRepository;

    public function __construct(
        PriceRepository $priceRepository,
        StationRepository $stationRepository
    ) {
        $this->priceRepository = $priceRepository;
        $this->stationRepository = $stationRepository;
    }

    /**
     * Get price trends for a station area over specified days
     */
    public function getPriceTrends(
        string $stationNumero,
        int $days = 7,
        ?float $radiusKm = null
    ): array {
        $radiusKm = $radiusKm ?? Config::get('analytics.radius.default');
        $cacheKey = "analytics:trends:{$stationNumero}:{$days}:{$radiusKm}";
        $cacheTtl = Config::get('analytics.cache.trends_ttl');
        
        return Cache::remember($cacheKey, $cacheTtl, function () use ($stationNumero, $days, $radiusKm) {
            $station = $this->stationRepository->getByNumero($stationNumero);
            
            if (!$station) {
                return [];
            }

            // Get nearby stations including the target station
            $nearbyStations = $this->getNearbyStations(
                $station->lat,
                $station->lng,
                $radiusKm,
                null // Include target station
            );

            $stationNumeros = $nearbyStations->pluck('numero')->toArray();

            // Get daily price averages for the area
            $endDate = now();
            $startDate = now()->subDays($days);

            $dailyPrices = DB::table('price_changes as pc')
                ->select([
                    'pc.fuel_type',
                    DB::raw('DATE(pc.changed_at) as date'),
                    DB::raw('AVG(pc.price) as avg_price'),
                    DB::raw('MIN(pc.price) as min_price'),
                    DB::raw('MAX(pc.price) as max_price'),
                    DB::raw('COUNT(DISTINCT pc.station_numero) as station_count')
                ])
                ->whereIn('pc.station_numero', $stationNumeros)
                ->whereBetween('pc.changed_at', [$startDate, $endDate])
                ->whereRaw('pc.id = (
                    SELECT MAX(id) FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type 
                    AND DATE(pc2.changed_at) = DATE(pc.changed_at)
                )')
                ->groupBy('pc.fuel_type', DB::raw('DATE(pc.changed_at)'))
                ->orderBy('date')
                ->get();

            // Organize by fuel type
            $trends = [];
            $fuelTypes = Config::get('analytics.fuel_types');
            
            foreach ($fuelTypes as $fuelType) {
                $fuelData = $dailyPrices->where('fuel_type', $fuelType);
                
                if ($fuelData->isEmpty()) {
                    continue;
                }

                $prices = $fuelData->pluck('avg_price')->toArray();
                $firstPrice = $prices[0] ?? 0;
                $lastPrice = end($prices) ?: 0;
                
                $trends[$fuelType] = [
                    'daily_prices' => $fuelData->map(function ($item) {
                        return [
                            'date' => $item->date,
                            'avg_price' => round($item->avg_price, 2),
                            'min_price' => round($item->min_price, 2),
                            'max_price' => round($item->max_price, 2),
                            'station_count' => $item->station_count
                        ];
                    })->toArray(),
                    'change_amount' => round($lastPrice - $firstPrice, 2),
                    'change_percentage' => $firstPrice > 0 
                        ? round((($lastPrice - $firstPrice) / $firstPrice) * 100, 2)
                        : 0,
                    'trend_direction' => $this->getTrendDirection($prices),
                    'statistics' => $this->calculateStatistics($prices)
                ];
            }

            return [
                'station_numero' => $stationNumero,
                'area_radius_km' => $radiusKm,
                'days' => $days,
                'trends' => $trends,
                'generated_at' => now()->toIso8601String()
            ];
        });
    }

    /**
     * Get competitor ranking for a station
     */
    public function getCompetitorRanking(
        string $stationNumero,
        ?float $radiusKm = null
    ): array {
        $radiusKm = $radiusKm ?? Config::get('analytics.radius.default');
        $cacheKey = "analytics:ranking:{$stationNumero}:{$radiusKm}";
        $cacheTtl = Config::get('analytics.cache.ranking_ttl');
        
        return Cache::remember($cacheKey, $cacheTtl, function () use ($stationNumero, $radiusKm) {
            $station = $this->stationRepository->getByNumero($stationNumero);
            
            if (!$station) {
                return [];
            }

            // Get all nearby stations including target
            $competitors = $this->getNearbyStations(
                $station->lat,
                $station->lng,
                $radiusKm,
                null
            );

            $stationNumeros = $competitors->pluck('numero')->toArray();

            // Get current prices for all stations
            $currentPrices = DB::table('price_changes as pc')
                ->select([
                    'pc.station_numero',
                    'pc.fuel_type',
                    'pc.price',
                    's.nombre as station_name',
                    's.brand'
                ])
                ->join('stations as s', 's.numero', '=', 'pc.station_numero')
                ->whereIn('pc.station_numero', $stationNumeros)
                ->whereRaw('pc.id = (
                    SELECT id FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type 
                    ORDER BY pc2.changed_at DESC 
                    LIMIT 1
                )')
                ->get();

            // Calculate rankings by fuel type
            $rankings = [];
            $fuelTypes = Config::get('analytics.fuel_types');
            
            foreach ($fuelTypes as $fuelType) {
                $fuelPrices = $currentPrices->where('fuel_type', $fuelType)
                    ->sortBy('price')
                    ->values();

                if ($fuelPrices->isEmpty()) {
                    continue;
                }

                $totalCompetitors = $fuelPrices->count();
                $targetPrice = $fuelPrices->where('station_numero', $stationNumero)->first();
                
                if (!$targetPrice) {
                    continue;
                }

                // Find position (1-based)
                $position = $fuelPrices->search(function ($item) use ($stationNumero) {
                    return $item->station_numero === $stationNumero;
                }) + 1;

                // Calculate percentile
                $percentile = round((($totalCompetitors - $position + 1) / $totalCompetitors) * 100);

                // Get market statistics
                $prices = $fuelPrices->pluck('price')->toArray();
                $stats = $this->calculateStatistics($prices);

                // Top and bottom competitors
                $topCompetitorsLimit = Config::get('analytics.limits.top_competitors');
                $topCompetitors = $fuelPrices->take($topCompetitorsLimit)->map(function ($item, $index) use ($stationNumero) {
                    return [
                        'position' => $index + 1,
                        'station_name' => $item->station_name,
                        'brand' => $item->brand,
                        'price' => round($item->price, 2),
                        'is_target' => $item->station_numero === $stationNumero
                    ];
                })->toArray();

                $rankings[$fuelType] = [
                    'position' => $position,
                    'total_competitors' => $totalCompetitors,
                    'percentile' => $percentile,
                    'your_price' => round($targetPrice->price, 2),
                    'market_average' => $stats['average'],
                    'market_median' => $stats['median'],
                    'price_difference_from_avg' => round($targetPrice->price - $stats['average'], 2),
                    'price_difference_percentage' => $stats['average'] > 0 
                        ? round((($targetPrice->price - $stats['average']) / $stats['average']) * 100, 2)
                        : 0,
                    'top_competitors' => $topCompetitors,
                    'recommendation' => $this->generateRankingRecommendation(
                        $position,
                        $totalCompetitors,
                        $targetPrice->price,
                        $stats['average']
                    )
                ];
            }

            return [
                'station_numero' => $stationNumero,
                'radius_km' => $radiusKm,
                'rankings' => $rankings,
                'generated_at' => now()->toIso8601String()
            ];
        });
    }

    /**
     * Get price history with analysis
     */
    public function getPriceHistory(
        string $stationNumero,
        int $days = 7,
        ?string $fuelType = null
    ): array {
        $cacheKey = "analytics:history:{$stationNumero}:{$days}:" . ($fuelType ?? 'all');
        $cacheTtl = Config::get('analytics.cache.history_ttl');
        
        return Cache::remember($cacheKey, $cacheTtl, function () use ($stationNumero, $days, $fuelType) {
            $query = DB::table('price_changes')
                ->where('station_numero', $stationNumero)
                ->where('changed_at', '>=', now()->subDays($days))
                ->orderBy('changed_at', 'desc');

            if ($fuelType) {
                $query->where('fuel_type', $fuelType);
            }

            $changes = $query->get();

            // Group by fuel type and date
            $history = [];
            $grouped = $changes->groupBy('fuel_type');

            foreach ($grouped as $fuel => $fuelChanges) {
                $dailyPrices = $fuelChanges->groupBy(function ($item) {
                    return \Carbon\Carbon::parse($item->changed_at)->format('Y-m-d');
                })->map(function ($dayChanges) {
                    $prices = $dayChanges->pluck('price')->toArray();
                    return [
                        'date' => $dayChanges->first()->changed_at,
                        'changes_count' => count($prices),
                        'first_price' => round($prices[0], 2),
                        'last_price' => round(end($prices), 2),
                        'min_price' => round(min($prices), 2),
                        'max_price' => round(max($prices), 2),
                        'avg_price' => round(array_sum($prices) / count($prices), 2)
                    ];
                });

                $allPrices = $fuelChanges->pluck('price')->toArray();
                $stats = $this->calculateStatistics($allPrices);

                $history[$fuel] = [
                    'daily_history' => $dailyPrices->values()->toArray(),
                    'total_changes' => count($allPrices),
                    'statistics' => $stats,
                    'trend_direction' => $this->getTrendDirection($allPrices)
                ];
            }

            return [
                'station_numero' => $stationNumero,
                'days' => $days,
                'fuel_type' => $fuelType,
                'history' => $history,
                'generated_at' => now()->toIso8601String()
            ];
        });
    }

    /**
     * Calculate statistical metrics for a price array
     * 
     * @param array $prices Array of price values
     * @return array Statistical metrics including average, median, std deviation
     */
    private function calculateStatistics(array $prices): array
    {
        if (empty($prices)) {
            return [
                'average' => 0,
                'median' => 0,
                'std_deviation' => 0,
                'min' => 0,
                'max' => 0
            ];
        }

        $count = count($prices);
        $average = array_sum($prices) / $count;
        
        // Calculate median
        sort($prices);
        $median = $count % 2 === 0
            ? ($prices[$count / 2 - 1] + $prices[$count / 2]) / 2
            : $prices[floor($count / 2)];

        // Calculate standard deviation
        $variance = 0;
        foreach ($prices as $price) {
            $variance += pow($price - $average, 2);
        }
        $stdDeviation = sqrt($variance / $count);

        return [
            'average' => round($average, 2),
            'median' => round($median, 2),
            'std_deviation' => round($stdDeviation, 2),
            'min' => round(min($prices), 2),
            'max' => round(max($prices), 2)
        ];
    }

    /**
     * Determine trend direction from price array
     * 
     * @param array $prices Array of price values over time
     * @return string Trend direction: 'rising', 'falling', or 'stable'
     */
    private function getTrendDirection(array $prices): string
    {
        if (count($prices) < 2) {
            return 'stable';
        }

        $firstHalf = array_slice($prices, 0, floor(count($prices) / 2));
        $secondHalf = array_slice($prices, floor(count($prices) / 2));

        $firstAvg = array_sum($firstHalf) / count($firstHalf);
        $secondAvg = array_sum($secondHalf) / count($secondHalf);

        $changePercentage = abs(($secondAvg - $firstAvg) / $firstAvg * 100);
        $trendThreshold = Config::get('analytics.thresholds.trend_change_percentage');

        if ($changePercentage < $trendThreshold) {
            return 'stable';
        } elseif ($secondAvg > $firstAvg) {
            return 'rising';
        } else {
            return 'falling';
        }
    }

    /**
     * Get nearby stations within specified radius
     * 
     * @param float $lat Latitude coordinate
     * @param float $lng Longitude coordinate  
     * @param float $radiusKm Search radius in kilometers
     * @param string|null $excludeNumero Station to exclude from results
     * @return Collection Collection of nearby stations
     */
    private function getNearbyStations(
        float $lat,
        float $lng,
        float $radiusKm,
        ?string $excludeNumero = null
    ): Collection {
        $query = DB::table('stations')
            ->select([
                'numero',
                'nombre',
                'brand',
                'lat',
                'lng',
                DB::raw("(6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
                        cos(radians(lng) - radians(?)) + sin(radians(?)) * 
                        sin(radians(lat)))) as distance")
            ])
            ->addBinding([$lat, $lng, $lat], 'select')
            ->where('is_active', true)
            ->having('distance', '<=', $radiusKm);

        if ($excludeNumero) {
            $query->where('numero', '!=', $excludeNumero);
        }

        return $query->orderBy('distance')->get();
    }

    /**
     * Generate ranking recommendation based on competitive position
     * 
     * @param int $position Current ranking position (1-based)
     * @param int $total Total number of competitors
     * @param float $yourPrice Station's current price
     * @param float $avgPrice Market average price
     * @return string Localized recommendation message
     */
    private function generateRankingRecommendation(
        int $position,
        int $total,
        float $yourPrice,
        float $avgPrice
    ): string {
        $percentile = ($total - $position + 1) / $total * 100;
        $priceDiff = $yourPrice - $avgPrice;
        $priceDiffPercent = abs($priceDiff / $avgPrice * 100);
        
        $excellentThreshold = Config::get('analytics.thresholds.excellent_percentile');
        $goodThreshold = Config::get('analytics.thresholds.good_percentile');
        $weakThreshold = Config::get('analytics.thresholds.weak_percentile');

        if ($percentile >= $excellentThreshold) {
            return "Excelente posición competitiva. Mantenga su estrategia actual.";
        } elseif ($percentile >= $goodThreshold) {
            if ($priceDiff > 0) {
                return sprintf(
                    "Posición media. Considere reducir $%.2f para mejorar competitividad.",
                    $priceDiff
                );
            } else {
                return "Buena posición. Monitor competidores cercanos.";
            }
        } elseif ($percentile >= $weakThreshold) {
            return sprintf(
                "Posición débil. Su precio está %.1f%% sobre el promedio. Ajuste recomendado.",
                $priceDiffPercent
            );
        } else {
            return sprintf(
                "Posición crítica. Reduzca $%.2f urgentemente para recuperar competitividad.",
                $priceDiff
            );
        }
    }
}