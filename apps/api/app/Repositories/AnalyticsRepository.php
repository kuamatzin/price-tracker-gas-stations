<?php

namespace App\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Analytics Repository
 * 
 * Handles all database operations for analytics data including
 * trend analysis, market statistics, and competitive positioning.
 */
class AnalyticsRepository
{
    /**
     * Get trend data for a station area
     */
    public function getTrendData(
        array $stationNumeros,
        Carbon $startDate,
        Carbon $endDate,
        ?string $fuelType = null
    ): Collection {
        $query = DB::table('price_changes as pc')
            ->select([
                'pc.fuel_type',
                DB::raw('DATE(pc.changed_at) as date'),
                DB::raw('AVG(pc.price) as avg_price'),
                DB::raw('MIN(pc.price) as min_price'),
                DB::raw('MAX(pc.price) as max_price'),
                DB::raw('COUNT(DISTINCT pc.station_numero) as station_count'),
                DB::raw('COUNT(*) as change_count')
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
            ->orderBy('date');

        if ($fuelType) {
            $query->where('pc.fuel_type', $fuelType);
        }

        return $query->get();
    }

    /**
     * Get competitor prices for ranking
     */
    public function getCompetitorPrices(
        array $stationNumeros,
        ?array $fuelTypes = null
    ): Collection {
        $query = DB::table('price_changes as pc')
            ->select([
                'pc.station_numero',
                'pc.fuel_type',
                'pc.price',
                'pc.changed_at',
                's.nombre as station_name',
                's.brand',
                's.lat',
                's.lng'
            ])
            ->join('stations as s', 's.numero', '=', 'pc.station_numero')
            ->whereIn('pc.station_numero', $stationNumeros)
            ->whereRaw('pc.id = (
                SELECT id FROM price_changes pc2 
                WHERE pc2.station_numero = pc.station_numero 
                AND pc2.fuel_type = pc.fuel_type 
                ORDER BY pc2.changed_at DESC 
                LIMIT 1
            )');

        if ($fuelTypes) {
            $query->whereIn('pc.fuel_type', $fuelTypes);
        }

        return $query->get();
    }

    /**
     * Get market statistics for an area
     */
    public function getMarketStatistics(
        int $municipioId,
        ?string $fuelType = null,
        int $days = 7
    ): array {
        $query = DB::table('price_changes as pc')
            ->join('stations as s', 's.numero', '=', 'pc.station_numero')
            ->where('s.municipio_id', $municipioId)
            ->where('s.is_active', true)
            ->where('pc.changed_at', '>=', now()->subDays($days))
            ->whereRaw('pc.id = (
                SELECT MAX(id) FROM price_changes pc2 
                WHERE pc2.station_numero = pc.station_numero 
                AND pc2.fuel_type = pc.fuel_type 
                AND DATE(pc2.changed_at) = DATE(pc.changed_at)
            )');

        if ($fuelType) {
            $query->where('pc.fuel_type', $fuelType);
        }

        $data = $query->select([
            'pc.fuel_type',
            DB::raw('AVG(pc.price) as average'),
            DB::raw('MIN(pc.price) as minimum'),
            DB::raw('MAX(pc.price) as maximum'),
            DB::raw('STDDEV(pc.price) as std_deviation'),
            DB::raw('COUNT(DISTINCT pc.station_numero) as station_count'),
            DB::raw('COUNT(*) as total_changes')
        ])
        ->groupBy('pc.fuel_type')
        ->get();

        $statistics = [];
        foreach ($data as $row) {
            $statistics[$row->fuel_type] = [
                'average' => round($row->average, 2),
                'minimum' => round($row->minimum, 2),
                'maximum' => round($row->maximum, 2),
                'std_deviation' => round($row->std_deviation, 2),
                'station_count' => $row->station_count,
                'total_changes' => $row->total_changes,
                'volatility' => $row->average > 0 
                    ? round(($row->std_deviation / $row->average) * 100, 2)
                    : 0
            ];
        }

        return $statistics;
    }

    /**
     * Get price changes for alert evaluation
     */
    public function getRecentPriceChanges(
        array $stationNumeros,
        int $hoursBack = 1
    ): Collection {
        return DB::table('price_changes as pc1')
            ->select([
                'pc1.station_numero',
                'pc1.fuel_type',
                'pc1.price as new_price',
                'pc1.changed_at',
                'pc2.price as old_price',
                DB::raw('((pc1.price - pc2.price) / pc2.price * 100) as change_percentage'),
                DB::raw('(pc1.price - pc2.price) as change_amount')
            ])
            ->leftJoin('price_changes as pc2', function ($join) {
                $join->on('pc2.station_numero', '=', 'pc1.station_numero')
                     ->on('pc2.fuel_type', '=', 'pc1.fuel_type')
                     ->on('pc2.id', '=', DB::raw('(
                         SELECT MAX(id) FROM price_changes pc3
                         WHERE pc3.station_numero = pc1.station_numero
                         AND pc3.fuel_type = pc1.fuel_type
                         AND pc3.id < pc1.id
                     )'));
            })
            ->whereIn('pc1.station_numero', $stationNumeros)
            ->where('pc1.changed_at', '>=', now()->subHours($hoursBack))
            ->whereNotNull('pc2.price')
            ->where('pc2.price', '>', 0)
            ->get();
    }

    /**
     * Get historical price data with aggregation
     */
    public function getHistoricalData(
        string $stationNumero,
        int $days,
        ?string $fuelType = null
    ): Collection {
        $query = DB::table('price_changes')
            ->where('station_numero', $stationNumero)
            ->where('changed_at', '>=', now()->subDays($days))
            ->orderBy('changed_at', 'desc');

        if ($fuelType) {
            $query->where('fuel_type', $fuelType);
        }

        return $query->get();
    }

    /**
     * Get stations with most price changes
     */
    public function getMostActiveStations(
        int $municipioId,
        int $days = 7,
        ?int $limit = null
    ): Collection {
        $limit = $limit ?? Config::get('analytics.limits.most_active_stations');
        return DB::table('price_changes as pc')
            ->join('stations as s', 's.numero', '=', 'pc.station_numero')
            ->select([
                's.numero',
                's.nombre',
                's.brand',
                DB::raw('COUNT(*) as change_count'),
                DB::raw('COUNT(DISTINCT pc.fuel_type) as fuel_types_changed'),
                DB::raw('MAX(pc.changed_at) as last_change')
            ])
            ->where('s.municipio_id', $municipioId)
            ->where('s.is_active', true)
            ->where('pc.changed_at', '>=', now()->subDays($days))
            ->groupBy('s.numero', 's.nombre', 's.brand')
            ->orderBy('change_count', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get price volatility metrics
     */
    public function getVolatilityMetrics(
        array $stationNumeros,
        int $days = 30
    ): array {
        $data = DB::table('price_changes')
            ->select([
                'fuel_type',
                'station_numero',
                DB::raw('COUNT(*) as change_count'),
                DB::raw('AVG(price) as avg_price'),
                DB::raw('STDDEV(price) as price_stddev'),
                DB::raw('MAX(price) - MIN(price) as price_range')
            ])
            ->whereIn('station_numero', $stationNumeros)
            ->where('changed_at', '>=', now()->subDays($days))
            ->groupBy('fuel_type', 'station_numero')
            ->get();

        $metrics = [];
        foreach ($data as $row) {
            if (!isset($metrics[$row->fuel_type])) {
                $metrics[$row->fuel_type] = [];
            }
            
            $metrics[$row->fuel_type][$row->station_numero] = [
                'change_frequency' => round($row->change_count / $days, 2),
                'avg_price' => round($row->avg_price, 2),
                'volatility' => $row->avg_price > 0 
                    ? round(($row->price_stddev / $row->avg_price) * 100, 2)
                    : 0,
                'price_range' => round($row->price_range, 2)
            ];
        }

        return $metrics;
    }

    /**
     * Get competitive positioning over time
     */
    public function getPositioningHistory(
        string $stationNumero,
        array $competitorNumeros,
        int $days = 7
    ): Collection {
        return DB::table('price_changes as pc')
            ->select([
                DB::raw('DATE(pc.changed_at) as date'),
                'pc.fuel_type',
                DB::raw("SUM(CASE WHEN pc.station_numero = ? THEN pc.price ELSE 0 END) as target_price"),
                DB::raw('AVG(CASE WHEN pc.station_numero != ? THEN pc.price ELSE NULL END) as competitor_avg'),
                DB::raw('MIN(CASE WHEN pc.station_numero != ? THEN pc.price ELSE NULL END) as competitor_min'),
                DB::raw('MAX(CASE WHEN pc.station_numero != ? THEN pc.price ELSE NULL END) as competitor_max')
            ])
            ->addBinding([$stationNumero, $stationNumero, $stationNumero, $stationNumero], 'select')
            ->whereIn('pc.station_numero', array_merge([$stationNumero], $competitorNumeros))
            ->where('pc.changed_at', '>=', now()->subDays($days))
            ->whereRaw('pc.id = (
                SELECT MAX(id) FROM price_changes pc2 
                WHERE pc2.station_numero = pc.station_numero 
                AND pc2.fuel_type = pc.fuel_type 
                AND DATE(pc2.changed_at) = DATE(pc.changed_at)
            )')
            ->groupBy(DB::raw('DATE(pc.changed_at)'), 'pc.fuel_type')
            ->orderBy('date')
            ->get();
    }

    /**
     * Get market share estimation based on pricing
     */
    public function estimateMarketShare(
        string $stationNumero,
        array $competitorNumeros,
        ?float $priceWeight = null
    ): array {
        $priceWeight = $priceWeight ?? Config::get('analytics.thresholds.price_weight');
        // Get current prices
        $prices = $this->getCompetitorPrices(
            array_merge([$stationNumero], $competitorNumeros)
        );

        $marketShare = [];
        $fuelTypes = Config::get('analytics.fuel_types');
        
        foreach ($fuelTypes as $fuelType) {
            $fuelPrices = $prices->where('fuel_type', $fuelType);
            
            if ($fuelPrices->isEmpty()) {
                continue;
            }

            $targetPrice = $fuelPrices->where('station_numero', $stationNumero)->first();
            
            if (!$targetPrice) {
                continue;
            }

            // Simple market share estimation based on price competitiveness
            $avgPrice = $fuelPrices->avg('price');
            $minPrice = $fuelPrices->min('price');
            $maxPrice = $fuelPrices->max('price');
            
            if ($maxPrice == $minPrice) {
                $marketShare[$fuelType] = round(100 / $fuelPrices->count(), 1);
            } else {
                // Lower price = higher market share
                $priceScore = 1 - (($targetPrice->price - $minPrice) / ($maxPrice - $minPrice));
                $baseShare = 100 / $fuelPrices->count();
                $marketShare[$fuelType] = round($baseShare * (1 + ($priceScore - 0.5) * $priceWeight), 1);
            }
        }

        return $marketShare;
    }

    /**
     * Create indexes for performance optimization
     * 
     * @return void
     */
    public function createIndexes(): void
    {
        // Check if we're using PostgreSQL or MySQL to use appropriate syntax
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'pgsql') {
            // PostgreSQL syntax
            DB::statement('CREATE INDEX IF NOT EXISTS idx_price_changes_trend 
                          ON price_changes(station_numero, fuel_type, changed_at DESC)');
            
            DB::statement('CREATE INDEX IF NOT EXISTS idx_price_changes_latest 
                          ON price_changes(station_numero, fuel_type, id DESC)');
            
            DB::statement('CREATE INDEX IF NOT EXISTS idx_price_changes_date 
                          ON price_changes(changed_at, station_numero, fuel_type)');
        } else {
            // MySQL doesn't support IF NOT EXISTS for indexes, use raw queries with error handling
            try {
                DB::statement('CREATE INDEX idx_price_changes_trend 
                              ON price_changes(station_numero, fuel_type, changed_at DESC)');
            } catch (\Exception $e) {
                // Index already exists, ignore
            }
            
            try {
                DB::statement('CREATE INDEX idx_price_changes_latest 
                              ON price_changes(station_numero, fuel_type, id DESC)');
            } catch (\Exception $e) {
                // Index already exists, ignore
            }
            
            try {
                DB::statement('CREATE INDEX idx_price_changes_date 
                              ON price_changes(changed_at, station_numero, fuel_type)');
            } catch (\Exception $e) {
                // Index already exists, ignore
            }
        }
    }
}