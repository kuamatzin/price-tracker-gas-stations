<?php

namespace App\Repositories;

use App\Models\PriceChange;
use App\Models\Station;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class HistoricalDataRepository
{
    public function getStationHistory(
        string $stationId,
        string $startDate,
        string $endDate,
        ?string $fuelType = null
    ): array {
        $station = Station::where('numero', $stationId)->first();
        if (!$station) {
            return [
                'station' => null,
                'period' => ['start' => $startDate, 'end' => $endDate],
                'series' => [],
                'summary' => ['total_changes' => 0, 'avg_change_percent' => 0]
            ];
        }

        $query = DB::table('price_changes')
            ->where('station_numero', $stationId)
            ->whereBetween('changed_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->orderBy('changed_at');

        if ($fuelType) {
            $query->where('fuel_type', $fuelType);
        }

        $priceChanges = $query->get();
        
        $series = $this->fillGapsInTimeSeries($priceChanges, $startDate, $endDate, $stationId, $fuelType);
        $summary = $this->calculateSummary($priceChanges);

        return [
            'station' => [
                'numero' => $station->numero,
                'nombre' => $station->nombre
            ],
            'period' => [
                'start' => $startDate,
                'end' => $endDate
            ],
            'series' => $series,
            'summary' => $summary
        ];
    }

    private function fillGapsInTimeSeries(
        Collection $priceChanges,
        string $startDate,
        string $endDate,
        string $stationId,
        ?string $fuelType
    ): array {
        $series = [];
        $fuelTypes = $fuelType ? [$fuelType] : ['regular', 'premium', 'diesel'];
        
        // Batch load all last known prices for all fuel types
        $lastKnownPrices = DB::table('price_changes')
            ->select('fuel_type', DB::raw('MAX(changed_at) as max_date'))
            ->where('station_numero', $stationId)
            ->whereIn('fuel_type', $fuelTypes)
            ->where('changed_at', '<', $startDate)
            ->groupBy('fuel_type');
        
        $lastPrices = DB::table('price_changes as pc')
            ->joinSub($lastKnownPrices, 'latest', function ($join) {
                $join->on('pc.fuel_type', '=', 'latest.fuel_type')
                     ->on('pc.changed_at', '=', 'latest.max_date');
            })
            ->where('pc.station_numero', $stationId)
            ->pluck('pc.price', 'pc.fuel_type')
            ->toArray();
        
        foreach ($fuelTypes as $fuel) {
            $fuelChanges = $priceChanges->where('fuel_type', $fuel);
            $lastKnownPrice = $lastPrices[$fuel] ?? null;

            $dateArray = [];
            $currentDate = Carbon::parse($startDate);
            $endDateCarbon = Carbon::parse($endDate);
            $previousPrice = $lastKnownPrice;

            while ($currentDate <= $endDateCarbon) {
                $dateStr = $currentDate->format('Y-m-d');
                
                // Find price change for this date
                $dayChanges = $fuelChanges->filter(function ($change) use ($dateStr) {
                    return Carbon::parse($change->changed_at)->format('Y-m-d') === $dateStr;
                });

                if ($dayChanges->isNotEmpty()) {
                    // Use the last price of the day if multiple changes
                    $lastChange = $dayChanges->sortBy('changed_at')->last();
                    $currentPrice = $lastChange->price;
                    $change = $previousPrice ? $currentPrice - $previousPrice : 0;
                } else {
                    // Fill gap with previous known price
                    $currentPrice = $previousPrice;
                    $change = 0;
                }

                if ($currentPrice !== null) {
                    $dateArray[] = [
                        'date' => $dateStr,
                        'price' => round($currentPrice, 2),
                        'change' => round($change, 2)
                    ];
                }

                $previousPrice = $currentPrice;
                $currentDate->addDay();
            }

            if (!empty($dateArray)) {
                $series[$fuel] = $dateArray;
            }
        }

        return $series;
    }

    private function calculateSummary(Collection $priceChanges): array
    {
        $totalChanges = $priceChanges->count();
        
        $avgChangePercent = 0;
        if ($totalChanges > 0) {
            $changePercents = [];
            $groupedByFuel = $priceChanges->groupBy('fuel_type');
            
            foreach ($groupedByFuel as $fuelType => $changes) {
                $sortedChanges = $changes->sortBy('changed_at');
                $firstPrice = $sortedChanges->first()->price;
                $lastPrice = $sortedChanges->last()->price;
                
                if ($firstPrice > 0) {
                    $changePercents[] = (($lastPrice - $firstPrice) / $firstPrice) * 100;
                }
            }
            
            if (count($changePercents) > 0) {
                $avgChangePercent = array_sum($changePercents) / count($changePercents);
            }
        }

        return [
            'total_changes' => $totalChanges,
            'avg_change_percent' => round($avgChangePercent, 2)
        ];
    }

    public function getLatestPrices(string $stationId): array
    {
        $subquery = DB::table('price_changes as pc1')
            ->select('station_numero', 'fuel_type', DB::raw('MAX(changed_at) as max_date'))
            ->where('station_numero', $stationId)
            ->groupBy('station_numero', 'fuel_type');

        return DB::table('price_changes as pc2')
            ->joinSub($subquery, 'latest', function ($join) {
                $join->on('pc2.station_numero', '=', 'latest.station_numero')
                     ->on('pc2.fuel_type', '=', 'latest.fuel_type')
                     ->on('pc2.changed_at', '=', 'latest.max_date');
            })
            ->select('pc2.fuel_type', 'pc2.price', 'pc2.changed_at')
            ->get()
            ->keyBy('fuel_type')
            ->toArray();
    }

    public function getStationPriceHistory(
        string $stationId,
        string $startDate,
        string $endDate,
        string $grouping = 'daily'
    ): Collection {
        $dbDriver = DB::connection()->getDriverName();
        $dateExpression = $this->getDateExpression($grouping, $dbDriver);

        return DB::table('price_changes')
            ->select(
                DB::raw($dateExpression . ' as period'),
                'fuel_type',
                DB::raw('AVG(price) as avg_price'),
                DB::raw('MIN(price) as min_price'),
                DB::raw('MAX(price) as max_price'),
                DB::raw('COUNT(*) as change_count')
            )
            ->where('station_numero', $stationId)
            ->whereBetween('changed_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->groupBy('period', 'fuel_type')
            ->orderBy('period')
            ->get();
    }

    private function getDateExpression(string $grouping, string $driver): string
    {
        switch ($driver) {
            case 'mysql':
                $format = match($grouping) {
                    'hourly' => '%Y-%m-%d %H:00:00',
                    'daily' => '%Y-%m-%d',
                    'weekly' => '%Y-%W',
                    'monthly' => '%Y-%m',
                    default => '%Y-%m-%d'
                };
                return "DATE_FORMAT(changed_at, '{$format}')";
                
            case 'pgsql':
                $format = match($grouping) {
                    'hourly' => 'YYYY-MM-DD HH24:00:00',
                    'daily' => 'YYYY-MM-DD',
                    'weekly' => 'IYYY-IW',
                    'monthly' => 'YYYY-MM',
                    default => 'YYYY-MM-DD'
                };
                return "TO_CHAR(changed_at, '{$format}')";
                
            case 'sqlite':
            default:
                $format = match($grouping) {
                    'hourly' => "strftime('%Y-%m-%d %H:00:00', changed_at)",
                    'daily' => "strftime('%Y-%m-%d', changed_at)",
                    'weekly' => "strftime('%Y-%W', changed_at)",
                    'monthly' => "strftime('%Y-%m', changed_at)",
                    default => "strftime('%Y-%m-%d', changed_at)"
                };
                return $format;
        }
    }
}