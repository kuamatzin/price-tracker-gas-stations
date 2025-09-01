<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class MarketAggregationService
{
    public function getMarketTrends(
        ?int $entidadId,
        ?int $municipioId,
        string $startDate,
        string $endDate,
        string $grouping = 'daily'
    ): array {
        $query = $this->buildMarketQuery($entidadId, $municipioId, $startDate, $endDate, $grouping);
        $trends = $query->get();

        // Group by date and format
        $groupedTrends = $this->groupAndFormatTrends($trends, $grouping);

        // Calculate summary statistics
        $summary = $this->calculateMarketSummary($trends, $startDate, $endDate);

        // Get area information
        $area = $this->getAreaInfo($entidadId, $municipioId);

        return [
            'area' => $area,
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
                'grouping' => $grouping,
            ],
            'trends' => $groupedTrends,
            'summary' => $summary,
        ];
    }

    private function buildMarketQuery(?int $entidadId, ?int $municipioId, string $startDate, string $endDate, string $grouping)
    {
        $dbDriver = DB::connection()->getDriverName();

        // Build database-agnostic date formatting
        $periodExpression = $this->getDateExpression($grouping, $dbDriver);

        // Build database-agnostic median calculation
        $medianExpression = $this->getMedianExpression($dbDriver);

        $query = DB::table('price_changes as pc')
            ->join('stations as s', 'pc.station_numero', '=', 's.numero')
            ->leftJoin('entidades as e', 's.entidad_id', '=', 'e.id')
            ->leftJoin('municipios as m', 's.municipio_id', '=', 'm.id')
            ->select(
                DB::raw($periodExpression.' as period'),
                'pc.fuel_type',
                DB::raw('AVG(pc.price) as avg_price'),
                DB::raw('MIN(pc.price) as min_price'),
                DB::raw('MAX(pc.price) as max_price'),
                DB::raw('STDDEV(pc.price) as price_stddev'),
                DB::raw($medianExpression.' as median_price'),
                DB::raw('COUNT(DISTINCT pc.station_numero) as station_count'),
                DB::raw('COUNT(*) as sample_size')
            )
            ->whereBetween('pc.changed_at', [$startDate.' 00:00:00', $endDate.' 23:59:59']);

        if ($entidadId) {
            $query->where('s.entidad_id', $entidadId);
        }

        if ($municipioId) {
            $query->where('s.municipio_id', $municipioId);
        }

        return $query->groupBy('period', 'pc.fuel_type')
            ->orderBy('period')
            ->orderBy('pc.fuel_type');
    }

    private function getDateExpression(string $grouping, string $driver): string
    {
        switch ($driver) {
            case 'mysql':
                $format = match ($grouping) {
                    'hourly' => '%Y-%m-%d %H:00:00',
                    'daily' => '%Y-%m-%d',
                    'weekly' => '%Y-%W',
                    'monthly' => '%Y-%m',
                    default => '%Y-%m-%d'
                };

                return "DATE_FORMAT(pc.changed_at, '{$format}')";

            case 'pgsql':
                $format = match ($grouping) {
                    'hourly' => 'YYYY-MM-DD HH24:00:00',
                    'daily' => 'YYYY-MM-DD',
                    'weekly' => 'IYYY-IW',
                    'monthly' => 'YYYY-MM',
                    default => 'YYYY-MM-DD'
                };

                return "TO_CHAR(pc.changed_at, '{$format}')";

            case 'sqlite':
            default:
                $format = match ($grouping) {
                    'hourly' => "strftime('%Y-%m-%d %H:00:00', pc.changed_at)",
                    'daily' => "strftime('%Y-%m-%d', pc.changed_at)",
                    'weekly' => "strftime('%Y-%W', pc.changed_at)",
                    'monthly' => "strftime('%Y-%m', pc.changed_at)",
                    default => "strftime('%Y-%m-%d', pc.changed_at)"
                };

                return $format;
        }
    }

    private function getMedianExpression(string $driver): string
    {
        switch ($driver) {
            case 'mysql':
                // MySQL 8.0+ supports window functions
                return 'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pc.price)';

            case 'pgsql':
                // PostgreSQL supports PERCENTILE_CONT
                return 'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pc.price)';

            case 'sqlite':
            default:
                // SQLite doesn't support PERCENTILE_CONT, use AVG as approximation
                // This is a simplified median - for production consider a subquery approach
                return 'AVG(pc.price)';
        }
    }

    private function groupAndFormatTrends($trends, string $grouping): array
    {
        $grouped = [];
        $nationalAvg = $this->getNationalAverage();

        foreach ($trends as $trend) {
            $period = $trend->period;

            if (! isset($grouped[$period])) {
                $grouped[$period] = [
                    'date' => $this->formatPeriodDate($period, $grouping),
                    'regular' => null,
                    'premium' => null,
                    'diesel' => null,
                ];
            }

            $fuelType = $trend->fuel_type;
            $nationalFuelAvg = $nationalAvg[$fuelType] ?? null;

            $grouped[$period][$fuelType] = [
                'avg' => round($trend->avg_price, 2),
                'min' => round($trend->min_price, 2),
                'max' => round($trend->max_price, 2),
                'median' => round($trend->median_price ?? $trend->avg_price, 2),
                'stddev' => round($trend->price_stddev, 2),
                'station_count' => $trend->station_count,
                'sample_size' => $trend->sample_size,
                'vs_national' => $this->compareToNational($trend->avg_price, $nationalFuelAvg),
            ];
        }

        return array_values($grouped);
    }

    private function formatPeriodDate(string $period, string $grouping): string
    {
        switch ($grouping) {
            case 'weekly':
                // Convert year-week to date range
                [$year, $week] = explode('-', $period);
                $date = Carbon::now()->setISODate($year, $week);

                return $date->startOfWeek()->format('Y-m-d').' - '.$date->endOfWeek()->format('Y-m-d');

            case 'monthly':
                // Convert year-month to readable format
                return Carbon::createFromFormat('Y-m', $period)->format('F Y');

            default:
                return $period;
        }
    }

    private function getNationalAverage(): array
    {
        $avgPrices = DB::table('price_changes')
            ->select(
                'fuel_type',
                DB::raw('AVG(price) as avg_price')
            )
            ->where('changed_at', '>=', now()->subDays(7))
            ->groupBy('fuel_type')
            ->get()
            ->keyBy('fuel_type')
            ->map(fn ($item) => $item->avg_price)
            ->toArray();

        return $avgPrices;
    }

    private function compareToNational(float $localAvg, ?float $nationalAvg): ?array
    {
        if ($nationalAvg === null || $nationalAvg == 0) {
            return null;
        }

        $difference = $localAvg - $nationalAvg;
        $percent = ($difference / $nationalAvg) * 100;

        return [
            'difference' => round($difference, 2),
            'percent' => round($percent, 2),
        ];
    }

    private function calculateMarketSummary($trends, string $startDate, string $endDate): array
    {
        // Get first and last period data for each fuel type
        $periodChanges = [];
        $volatilityIndex = [];

        $fuelTypes = ['regular', 'premium', 'diesel'];

        foreach ($fuelTypes as $fuelType) {
            $fuelTrends = $trends->where('fuel_type', $fuelType)->sortBy('period');

            if ($fuelTrends->isNotEmpty()) {
                $first = $fuelTrends->first();
                $last = $fuelTrends->last();

                if ($first->avg_price > 0) {
                    $periodChanges[$fuelType] = round(
                        (($last->avg_price - $first->avg_price) / $first->avg_price) * 100,
                        2
                    );
                }

                // Calculate average volatility (stddev)
                $avgStddev = $fuelTrends->avg('price_stddev');
                $volatilityIndex[$fuelType] = round($avgStddev, 2);
            }
        }

        return [
            'period_change' => $periodChanges,
            'volatility_index' => array_sum($volatilityIndex) > 0
                ? round(array_sum($volatilityIndex) / count($volatilityIndex), 2)
                : 0,
            'total_stations' => $trends->max('station_count') ?? 0,
            'total_samples' => $trends->sum('sample_size'),
        ];
    }

    private function getAreaInfo(?int $entidadId, ?int $municipioId): array
    {
        $area = [];

        if ($entidadId) {
            $entidad = DB::table('entidades')->where('id', $entidadId)->first();
            $area['entidad'] = $entidad ? $entidad->nombre : null;
        }

        if ($municipioId) {
            $municipio = DB::table('municipios')->where('id', $municipioId)->first();
            $area['municipio'] = $municipio ? $municipio->nombre : null;
        }

        if (empty($area)) {
            $area = ['scope' => 'national'];
        }

        return $area;
    }

    public function getStationCorrelations(array $stationIds, string $startDate, string $endDate): array
    {
        $correlations = [];

        foreach ($stationIds as $i => $stationA) {
            foreach ($stationIds as $j => $stationB) {
                if ($i >= $j) {
                    continue;
                }

                $correlation = $this->calculateCorrelation($stationA, $stationB, $startDate, $endDate);
                if ($correlation !== null) {
                    $correlations[] = [
                        'station_a' => $stationA,
                        'station_b' => $stationB,
                        'correlation' => $correlation,
                    ];
                }
            }
        }

        // Sort by correlation strength
        usort($correlations, fn ($a, $b) => abs($b['correlation']) <=> abs($a['correlation']));

        return $correlations;
    }

    private function calculateCorrelation(string $stationA, string $stationB, string $startDate, string $endDate): ?float
    {
        $pricesA = DB::table('price_changes')
            ->where('station_numero', $stationA)
            ->whereBetween('changed_at', [$startDate, $endDate])
            ->orderBy('changed_at')
            ->pluck('price')
            ->toArray();

        $pricesB = DB::table('price_changes')
            ->where('station_numero', $stationB)
            ->whereBetween('changed_at', [$startDate, $endDate])
            ->orderBy('changed_at')
            ->pluck('price')
            ->toArray();

        if (count($pricesA) < 2 || count($pricesB) < 2) {
            return null;
        }

        // Align arrays to same length
        $minLength = min(count($pricesA), count($pricesB));
        $pricesA = array_slice($pricesA, 0, $minLength);
        $pricesB = array_slice($pricesB, 0, $minLength);

        // Calculate Pearson correlation
        $meanA = array_sum($pricesA) / count($pricesA);
        $meanB = array_sum($pricesB) / count($pricesB);

        $numerator = 0;
        $denominatorA = 0;
        $denominatorB = 0;

        for ($i = 0; $i < $minLength; $i++) {
            $diffA = $pricesA[$i] - $meanA;
            $diffB = $pricesB[$i] - $meanB;

            $numerator += $diffA * $diffB;
            $denominatorA += $diffA * $diffA;
            $denominatorB += $diffB * $diffB;
        }

        $denominator = sqrt($denominatorA * $denominatorB);

        return $denominator != 0 ? round($numerator / $denominator, 3) : null;
    }
}
