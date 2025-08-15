<?php

namespace App\Repositories;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GeographicRepository
{
    /**
     * Get the latest prices subquery that works with both SQLite and PostgreSQL
     */
    private function getLatestPricesSubquery()
    {
        $twentyFourHoursAgo = Carbon::now()->subHours(24);
        
        return DB::table('price_changes as pc1')
            ->select('pc1.station_numero', 'pc1.fuel_type', 'pc1.price', 'pc1.changed_at')
            ->whereRaw('pc1.changed_at = (
                SELECT MAX(pc2.changed_at) 
                FROM price_changes pc2 
                WHERE pc2.station_numero = pc1.station_numero 
                AND pc2.fuel_type = pc1.fuel_type
                AND pc2.changed_at >= ?
            )', [$twentyFourHoursAgo]);
    }

    public function getEstadoAggregates(array $filters = [])
    {
        // Use materialized view for PostgreSQL if available
        if (config('database.default') === 'pgsql' && $this->materializedViewExists('estado_price_aggregates')) {
            return $this->getEstadoAggregatesFromView($filters);
        }

        // Fallback to regular query for SQLite or if view doesn't exist
        // Get latest prices for each station and fuel type
        $latestPrices = $this->getLatestPricesSubquery();

        $query = DB::table('entidades as e')
            ->join('stations as s', 's.entidad_id', '=', 'e.id')
            ->joinSub($latestPrices, 'pc', function ($join) {
                $join->on('pc.station_numero', '=', 's.numero');
            })
            ->where('s.is_active', true)
            ->selectRaw('
                e.id as estado_id,
                e.nombre as estado_nombre,
                e.codigo as estado_codigo,
                pc.fuel_type,
                AVG(pc.price) as avg_price,
                MIN(pc.price) as min_price,
                MAX(pc.price) as max_price,
                COUNT(DISTINCT s.numero) as station_count
            ')
            ->groupBy('e.id', 'e.nombre', 'e.codigo', 'pc.fuel_type');

        if (!empty($filters['fuel_type'])) {
            $query->where('pc.fuel_type', $filters['fuel_type']);
        }

        $results = $query->get();

        // Batch fetch all price data for statistics calculation
        $estadoIds = $results->pluck('estado_id')->unique();
        $estadoStats = $this->batchCalculateEstadoStatistics($estadoIds, $filters);

        // Process results into structured format
        $estados = [];
        $nationalTotals = ['regular' => [], 'premium' => [], 'diesel' => []];

        foreach ($results as $row) {
            if (!isset($estados[$row->estado_id])) {
                $estados[$row->estado_id] = [
                    'estado_id' => $row->estado_id,
                    'estado_nombre' => $row->estado_nombre,
                    'estado_codigo' => $row->estado_codigo,
                    'fuel_prices' => [],
                    'total_stations' => 0
                ];
            }

            // Use pre-calculated statistics
            $stats = $estadoStats[$row->estado_id][$row->fuel_type] ?? ['median' => 0, 'stddev' => 0];

            $estados[$row->estado_id]['fuel_prices'][$row->fuel_type] = [
                'avg' => round($row->avg_price, 2),
                'min' => $row->min_price,
                'max' => $row->max_price,
                'median' => $stats['median'],
                'stddev' => $stats['stddev'],
                'spread' => round($row->max_price - $row->min_price, 2),
                'station_count' => $row->station_count
            ];

            $estados[$row->estado_id]['total_stations'] = max(
                $estados[$row->estado_id]['total_stations'],
                $row->station_count
            );

            if (isset($nationalTotals[$row->fuel_type])) {
                $nationalTotals[$row->fuel_type][] = $row->avg_price;
            }
        }

        // Calculate national averages
        $nationalAverage = [];
        foreach ($nationalTotals as $fuel => $prices) {
            if (count($prices) > 0) {
                $nationalAverage[$fuel] = round(array_sum($prices) / count($prices), 2);
            }
        }

        // Find cheapest and most expensive estados for regular fuel
        $regularPrices = [];
        foreach ($estados as $estado) {
            if (isset($estado['fuel_prices']['regular'])) {
                $regularPrices[$estado['estado_nombre']] = $estado['fuel_prices']['regular']['avg'];
            }
        }

        $cheapestEstado = '';
        $mostExpensiveEstado = '';
        
        if (!empty($regularPrices)) {
            asort($regularPrices);
            $cheapestEstado = array_key_first($regularPrices);
            $mostExpensiveEstado = array_key_last($regularPrices);
        }

        // Calculate market efficiency for each estado
        foreach ($estados as &$estado) {
            $estado['market_efficiency'] = $this->calculateMarketEfficiency($estado['fuel_prices']);
            $estado['last_update'] = now()->toIso8601String();
        }

        // Sort estados
        $sortBy = $filters['sort_by'] ?? 'estado_nombre';
        $sortOrder = $filters['sort_order'] ?? 'asc';

        usort($estados, function ($a, $b) use ($sortBy, $sortOrder) {
            $aVal = $a[$sortBy] ?? $a['estado_nombre'];
            $bVal = $b[$sortBy] ?? $b['estado_nombre'];
            
            if ($sortOrder === 'desc') {
                return $bVal <=> $aVal;
            }
            return $aVal <=> $bVal;
        });

        return [
            'estados' => array_values($estados),
            'summary' => [
                'total_estados' => count($estados),
                'national_average' => $nationalAverage,
                'cheapest_estado' => $cheapestEstado,
                'most_expensive_estado' => $mostExpensiveEstado
            ]
        ];
    }

    public function getMunicipiosByEstado($estadoId, array $filters = [], $page = 1, $perPage = 20)
    {
        // First validate estado exists
        $estado = DB::table('entidades')->where('id', $estadoId)->first();
        
        if (!$estado) {
            return null;
        }

        // Get latest prices for each station and fuel type
        $latestPrices = $this->getLatestPricesSubquery();

        $query = DB::table('municipios as m')
            ->join('stations as s', 's.municipio_id', '=', 'm.id')
            ->joinSub($latestPrices, 'pc', function ($join) {
                $join->on('pc.station_numero', '=', 's.numero');
            })
            ->where('m.entidad_id', $estadoId)
            ->where('s.is_active', true)
            ->selectRaw('
                m.id as municipio_id,
                m.nombre as municipio_nombre,
                pc.fuel_type,
                AVG(pc.price) as avg_price,
                MIN(pc.price) as min_price,
                MAX(pc.price) as max_price,
                COUNT(DISTINCT s.numero) as station_count
            ')
            ->groupBy('m.id', 'm.nombre', 'pc.fuel_type');

        if (!empty($filters['fuel_type'])) {
            $query->where('pc.fuel_type', $filters['fuel_type']);
        }

        $total = DB::table('municipios')->where('entidad_id', $estadoId)->count();
        
        $results = $query->get();

        // Process results
        $municipios = [];
        foreach ($results as $row) {
            if (!isset($municipios[$row->municipio_id])) {
                $municipios[$row->municipio_id] = [
                    'municipio_id' => $row->municipio_id,
                    'municipio_nombre' => $row->municipio_nombre,
                    'fuel_prices' => [],
                    'station_count' => 0,
                    'station_density' => 0
                ];
            }

            // Calculate stddev in PHP
            $twentyFourHoursAgo = Carbon::now()->subHours(24);
            $pricesForStats = DB::table('stations as s')
                ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                ->where('s.municipio_id', $row->municipio_id)
                ->where('pc.fuel_type', $row->fuel_type)
                ->where('s.is_active', true)
                ->whereRaw('pc.changed_at = (
                    SELECT MAX(pc2.changed_at) 
                    FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type
                    AND pc.changed_at >= ?
                )', [$twentyFourHoursAgo])
                ->pluck('pc.price')
                ->toArray();

            $stddev = $this->calculateStdDev($pricesForStats);

            $municipios[$row->municipio_id]['fuel_prices'][$row->fuel_type] = [
                'avg' => round($row->avg_price, 2),
                'min' => $row->min_price,
                'max' => $row->max_price,
                'stddev' => $stddev,
                'spread' => round($row->max_price - $row->min_price, 2)
            ];

            $municipios[$row->municipio_id]['station_count'] = max(
                $municipios[$row->municipio_id]['station_count'],
                $row->station_count
            );

            // Calculate station density
            $totalStations = DB::table('stations')
                ->where('municipio_id', $row->municipio_id)
                ->where('is_active', true)
                ->count();
            
            $municipios[$row->municipio_id]['station_density'] = $totalStations > 0 
                ? round($row->station_count / $totalStations, 2) 
                : 0;
        }

        // Calculate competitiveness index
        foreach ($municipios as &$municipio) {
            $municipio['competitiveness_index'] = $this->calculateCompetitivenessIndex($municipio['fuel_prices']);
        }

        // Sort and paginate
        $sortBy = $filters['sort_by'] ?? 'municipio_nombre';
        $sortOrder = $filters['sort_order'] ?? 'asc';

        usort($municipios, function ($a, $b) use ($sortBy, $sortOrder) {
            $aVal = $a[$sortBy] ?? $a['municipio_nombre'];
            $bVal = $b[$sortBy] ?? $b['municipio_nombre'];
            
            if ($sortOrder === 'desc') {
                return $bVal <=> $aVal;
            }
            return $aVal <=> $bVal;
        });

        $offset = ($page - 1) * $perPage;
        $paginatedMunicipios = array_slice($municipios, $offset, $perPage);

        return [
            'data' => array_values($paginatedMunicipios),
            'pagination' => [
                'total' => count($municipios),
                'per_page' => (int) $perPage,
                'current_page' => (int) $page,
                'last_page' => (int) ceil(count($municipios) / $perPage),
                'from' => $offset + 1,
                'to' => min($offset + $perPage, count($municipios))
            ],
            'estado' => [
                'id' => $estado->id,
                'nombre' => $estado->nombre,
                'codigo' => $estado->codigo
            ]
        ];
    }

    public function getMunicipioStats($municipioId)
    {
        // Validate municipio exists
        $municipio = DB::table('municipios as m')
            ->join('entidades as e', 'e.id', '=', 'm.entidad_id')
            ->where('m.id', $municipioId)
            ->select('m.*', 'e.nombre as estado_nombre')
            ->first();

        if (!$municipio) {
            return null;
        }

        $stats = [];
        $fuelTypes = ['regular', 'premium', 'diesel'];

        $twentyFourHoursAgo = Carbon::now()->subHours(24);
        
        foreach ($fuelTypes as $fuelType) {
            // Get current prices with station details using subquery for latest prices
            $prices = DB::table('stations as s')
                ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                ->where('s.municipio_id', $municipioId)
                ->where('pc.fuel_type', $fuelType)
                ->where('s.is_active', true)
                ->whereRaw('pc.changed_at = (
                    SELECT MAX(pc2.changed_at) 
                    FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type
                    AND pc.changed_at >= ?
                )', [$twentyFourHoursAgo])
                ->select('s.numero', 's.nombre', 's.brand', 'pc.price', 'pc.changed_at')
                ->get();

            if ($prices->isEmpty()) {
                continue;
            }

            $pricesArray = $prices->pluck('price')->toArray();
            $avgPrice = array_sum($pricesArray) / count($pricesArray);

            // Calculate statistics
            $statistics = [
                'avg' => round($avgPrice, 2),
                'min' => min($pricesArray),
                'max' => max($pricesArray),
                'median' => $this->calculateMedian($pricesArray),
                'stddev' => round($this->calculateStdDev($pricesArray), 2),
                'coefficient_variation' => $avgPrice > 0 ? round($this->calculateStdDev($pricesArray) / $avgPrice * 100, 2) : 0
            ];

            // Get top performers (cheapest)
            $topPerformers = $prices->sortBy('price')->take(3)->map(function ($station) use ($avgPrice) {
                return [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                    'brand' => $station->brand,
                    'price' => $station->price,
                    'vs_avg' => round($station->price - $avgPrice, 2)
                ];
            })->values()->toArray();

            // Get bottom performers (most expensive)
            $bottomPerformers = $prices->sortByDesc('price')->take(3)->map(function ($station) use ($avgPrice) {
                return [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                    'brand' => $station->brand,
                    'price' => $station->price,
                    'vs_avg' => round($station->price - $avgPrice, 2)
                ];
            })->values()->toArray();

            // Calculate price distribution
            $distribution = $this->calculatePriceDistribution($pricesArray);

            // Get historical comparison (vs last week) - adjusted for SQLite
            $lastWeekAvg = DB::table('price_changes')
                ->whereIn('station_numero', $prices->pluck('numero'))
                ->where('fuel_type', $fuelType)
                ->whereBetween('changed_at', [
                    date('Y-m-d H:i:s', strtotime('-8 days')),
                    date('Y-m-d H:i:s', strtotime('-7 days'))
                ])
                ->avg('price');

            $vsLastWeek = $lastWeekAvg ? round((($avgPrice - $lastWeekAvg) / $lastWeekAvg) * 100, 2) : null;

            // Get estado average for comparison
            $estadoAvg = DB::table('stations as s')
                ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                ->where('s.entidad_id', $municipio->entidad_id)
                ->where('pc.fuel_type', $fuelType)
                ->where('s.is_active', true)
                ->whereRaw('pc.changed_at = (
                    SELECT MAX(pc2.changed_at) 
                    FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type
                    AND pc.changed_at >= ?
                )', [$twentyFourHoursAgo])
                ->avg('pc.price');

            $vsEstadoAvg = $estadoAvg ? round($avgPrice - $estadoAvg, 2) : null;

            $stats[$fuelType] = [
                'statistics' => $statistics,
                'top_performers' => $topPerformers,
                'bottom_performers' => $bottomPerformers,
                'station_count' => count($prices),
                'price_distribution' => $distribution,
                'last_update' => $prices->max('changed_at'),
                'vs_last_week' => $vsLastWeek,
                'vs_estado_avg' => $vsEstadoAvg
            ];
        }

        $trends = [
            'vs_last_week' => [],
            'vs_estado_avg' => []
        ];

        foreach ($fuelTypes as $fuelType) {
            $trends['vs_last_week'][$fuelType] = $stats[$fuelType]['vs_last_week'] ?? null;
            $trends['vs_estado_avg'][$fuelType] = $stats[$fuelType]['vs_estado_avg'] ?? null;
            
            // Remove these from individual stats to avoid duplication
            if (isset($stats[$fuelType])) {
                unset($stats[$fuelType]['vs_last_week']);
                unset($stats[$fuelType]['vs_estado_avg']);
            }
        }

        return [
            'municipio' => [
                'id' => $municipio->id,
                'nombre' => $municipio->nombre,
                'estado' => $municipio->estado_nombre
            ],
            'statistics' => $stats,
            'trends' => $trends
        ];
    }

    private function calculateMarketEfficiency($fuelPrices)
    {
        if (empty($fuelPrices)) {
            return 0;
        }

        $efficiency = 0;
        $count = 0;

        foreach ($fuelPrices as $fuel => $prices) {
            if (isset($prices['stddev']) && isset($prices['avg']) && $prices['avg'] > 0) {
                // Lower coefficient of variation indicates higher efficiency
                $cv = $prices['stddev'] / $prices['avg'];
                $efficiency += (1 - min($cv, 1));
                $count++;
            }
        }

        return $count > 0 ? round($efficiency / $count, 2) : 0;
    }

    private function calculateCompetitivenessIndex($fuelPrices)
    {
        if (empty($fuelPrices)) {
            return 0;
        }

        $index = 0;
        $count = 0;

        foreach ($fuelPrices as $fuel => $prices) {
            if (isset($prices['spread']) && isset($prices['avg']) && $prices['avg'] > 0) {
                // Higher spread relative to average indicates more competition
                $relativeSpread = $prices['spread'] / $prices['avg'];
                $index += min($relativeSpread * 100, 100);
                $count++;
            }
        }

        return $count > 0 ? round($index / $count, 2) : 0;
    }

    private function calculateMedian($values)
    {
        if (empty($values)) {
            return 0;
        }
        
        sort($values);
        $count = count($values);
        
        if ($count % 2 == 0) {
            return round(($values[$count / 2 - 1] + $values[$count / 2]) / 2, 2);
        }
        
        return round($values[floor($count / 2)], 2);
    }

    private function calculateStdDev($values)
    {
        $count = count($values);
        if ($count <= 1) {
            return 0;
        }

        $mean = array_sum($values) / $count;
        $sum = 0;

        foreach ($values as $value) {
            $sum += pow($value - $mean, 2);
        }

        return round(sqrt($sum / ($count - 1)), 2);
    }

    private function calculatePriceDistribution($prices)
    {
        if (empty($prices)) {
            return [];
        }

        $min = min($prices);
        $max = max($prices);
        $range = $max - $min;
        
        if ($range == 0) {
            return [sprintf("%.2f", $min) => count($prices)];
        }

        $bucketSize = $range / 5; // 5 buckets
        $distribution = [];

        for ($i = 0; $i < 5; $i++) {
            $bucketMin = $min + ($i * $bucketSize);
            $bucketMax = $min + (($i + 1) * $bucketSize);
            $key = sprintf("%.2f-%.2f", $bucketMin, $bucketMax);
            $distribution[$key] = 0;
        }

        foreach ($prices as $price) {
            $bucketIndex = min(floor(($price - $min) / $bucketSize), 4);
            $bucketMin = $min + ($bucketIndex * $bucketSize);
            $bucketMax = $min + (($bucketIndex + 1) * $bucketSize);
            $key = sprintf("%.2f-%.2f", $bucketMin, $bucketMax);
            if (isset($distribution[$key])) {
                $distribution[$key]++;
            }
        }

        return $distribution;
    }

    private function materializedViewExists($viewName)
    {
        if (config('database.default') !== 'pgsql') {
            return false;
        }

        $exists = DB::select("
            SELECT EXISTS (
                SELECT 1
                FROM pg_matviews
                WHERE matviewname = ?
            ) as exists
        ", [$viewName]);

        return $exists[0]->exists ?? false;
    }

    private function batchCalculateEstadoStatistics($estadoIds, $filters = [])
    {
        if ($estadoIds->isEmpty()) {
            return [];
        }

        $twentyFourHoursAgo = Carbon::now()->subHours(24);
        
        // Fetch all prices in one query
        $allPrices = DB::table('stations as s')
            ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
            ->whereIn('s.entidad_id', $estadoIds)
            ->where('s.is_active', true)
            ->whereRaw('pc.changed_at = (
                SELECT MAX(pc2.changed_at) 
                FROM price_changes pc2 
                WHERE pc2.station_numero = pc.station_numero 
                AND pc2.fuel_type = pc.fuel_type
                AND pc.changed_at >= ?
            )', [$twentyFourHoursAgo])
            ->select('s.entidad_id', 'pc.fuel_type', 'pc.price')
            ->get();

        // Group by estado and fuel type
        $groupedPrices = [];
        foreach ($allPrices as $price) {
            $groupedPrices[$price->entidad_id][$price->fuel_type][] = $price->price;
        }

        // Calculate statistics for each group
        $statistics = [];
        foreach ($groupedPrices as $estadoId => $fuelTypes) {
            foreach ($fuelTypes as $fuelType => $prices) {
                $statistics[$estadoId][$fuelType] = [
                    'median' => $this->calculateMedian($prices),
                    'stddev' => $this->calculateStdDev($prices)
                ];
            }
        }

        return $statistics;
    }

    private function getEstadoAggregatesFromView(array $filters = [])
    {
        $query = DB::table('estado_price_aggregates');

        if (!empty($filters['fuel_type'])) {
            $query->where('fuel_type', $filters['fuel_type']);
        }

        $results = $query->get();

        // Process results into structured format
        $estados = [];
        $nationalTotals = ['regular' => [], 'premium' => [], 'diesel' => []];

        foreach ($results as $row) {
            if (!isset($estados[$row->estado_id])) {
                $estados[$row->estado_id] = [
                    'estado_id' => $row->estado_id,
                    'estado_nombre' => $row->estado_nombre,
                    'estado_codigo' => $row->estado_codigo,
                    'fuel_prices' => [],
                    'total_stations' => 0
                ];
            }

            $estados[$row->estado_id]['fuel_prices'][$row->fuel_type] = [
                'avg' => round($row->avg_price, 2),
                'min' => $row->min_price,
                'max' => $row->max_price,
                'median' => round($row->median_price, 2),
                'stddev' => round($row->stddev_price, 2),
                'spread' => round($row->max_price - $row->min_price, 2),
                'station_count' => $row->station_count
            ];

            $estados[$row->estado_id]['total_stations'] = max(
                $estados[$row->estado_id]['total_stations'],
                $row->station_count
            );

            if (isset($nationalTotals[$row->fuel_type])) {
                $nationalTotals[$row->fuel_type][] = $row->avg_price;
            }
        }

        // Calculate national averages
        $nationalAverage = [];
        foreach ($nationalTotals as $fuel => $prices) {
            if (count($prices) > 0) {
                $nationalAverage[$fuel] = round(array_sum($prices) / count($prices), 2);
            }
        }

        // Find cheapest and most expensive estados
        $regularPrices = [];
        foreach ($estados as $estado) {
            if (isset($estado['fuel_prices']['regular'])) {
                $regularPrices[$estado['estado_nombre']] = $estado['fuel_prices']['regular']['avg'];
            }
        }

        $cheapestEstado = '';
        $mostExpensiveEstado = '';
        
        if (!empty($regularPrices)) {
            asort($regularPrices);
            $cheapestEstado = array_key_first($regularPrices);
            $mostExpensiveEstado = array_key_last($regularPrices);
        }

        // Calculate market efficiency for each estado
        foreach ($estados as &$estado) {
            $estado['market_efficiency'] = $this->calculateMarketEfficiency($estado['fuel_prices']);
            $estado['last_update'] = now()->toIso8601String();
        }

        // Sort estados
        $sortBy = $filters['sort_by'] ?? 'estado_nombre';
        $sortOrder = $filters['sort_order'] ?? 'asc';

        usort($estados, function ($a, $b) use ($sortBy, $sortOrder) {
            $aVal = $a[$sortBy] ?? $a['estado_nombre'];
            $bVal = $b[$sortBy] ?? $b['estado_nombre'];
            
            if ($sortOrder === 'desc') {
                return $bVal <=> $aVal;
            }
            return $aVal <=> $bVal;
        });

        return [
            'estados' => array_values($estados),
            'summary' => [
                'total_estados' => count($estados),
                'national_average' => $nationalAverage,
                'cheapest_estado' => $cheapestEstado,
                'most_expensive_estado' => $mostExpensiveEstado
            ]
        ];
    }
}