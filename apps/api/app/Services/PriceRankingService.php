<?php

namespace App\Services;

use App\Models\Station;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PriceRankingService
{
    protected array $fuelTypes = ['regular', 'premium', 'diesel'];

    public function calculateRankings(Station $userStation, Collection $competitors): array
    {
        $rankings = [];

        foreach ($this->fuelTypes as $fuelType) {
            $rankings[$fuelType] = $this->calculateFuelTypeRanking(
                $userStation,
                $competitors,
                $fuelType
            );
        }

        return $rankings;
    }

    protected function calculateFuelTypeRanking(Station $userStation, Collection $competitors, string $fuelType): array
    {
        $allStations = $this->collectStationPrices($userStation, $competitors, $fuelType);

        if ($allStations->isEmpty()) {
            return $this->emptyRanking($fuelType);
        }

        $sortedStations = $allStations->sortBy('price')->values();
        $userPrice = $allStations->where('numero', $userStation->numero)->first()['price'] ?? null;

        if (! $userPrice) {
            return $this->emptyRanking($fuelType);
        }

        $rank = $this->calculateRank($sortedStations, $userStation->numero);
        $total = $sortedStations->count();
        $percentile = $this->calculatePercentile($rank, $total);
        $diffFromFirst = $userPrice - $sortedStations->first()['price'];

        $yesterdayRank = $this->getYesterdayRank($userStation->numero, $fuelType, $competitors);
        $trend = $this->determineTrend($rank, $yesterdayRank);
        $position = $this->determinePosition($percentile);

        return [
            'rank' => $rank,
            'total' => $total,
            'percentile' => round($percentile, 1),
            'price' => $userPrice,
            'diff_from_first' => round($diffFromFirst, 2),
            'position' => $position,
            'trend' => $trend,
            'yesterday_rank' => $yesterdayRank,
        ];
    }

    protected function collectStationPrices(Station $userStation, Collection $competitors, string $fuelType): Collection
    {
        $competitorPrices = $competitors->map(function ($competitor) use ($fuelType) {
            $price = $competitor['prices'][$fuelType] ?? null;
            if ($price) {
                return [
                    'numero' => $competitor['numero'],
                    'price' => $price,
                ];
            }

            return null;
        })->filter();

        $userPrice = $this->getUserCurrentPrice($userStation->numero, $fuelType);

        if ($userPrice) {
            $competitorPrices->push([
                'numero' => $userStation->numero,
                'price' => $userPrice,
            ]);
        }

        return $competitorPrices;
    }

    protected function getUserCurrentPrice(string $stationNumero, string $fuelType): ?float
    {
        $price = DB::table('price_changes')
            ->where('station_numero', $stationNumero)
            ->where('fuel_type', $fuelType)
            ->orderBy('changed_at', 'desc')
            ->first();

        return $price ? $price->price : null;
    }

    protected function calculateRank(Collection $sortedStations, string $userStationNumero): int
    {
        $rank = 1;
        $prevPrice = null;
        $actualRank = 1;

        foreach ($sortedStations as $index => $station) {
            if ($prevPrice !== null && $station['price'] > $prevPrice) {
                $rank = $index + 1;
            }

            if ($station['numero'] === $userStationNumero) {
                return $rank;
            }

            $prevPrice = $station['price'];
        }

        return $rank;
    }

    protected function calculatePercentile(int $rank, int $total): float
    {
        if ($total <= 1) {
            return 0;
        }

        return (($rank - 1) / ($total - 1)) * 100;
    }

    protected function getYesterdayRank(string $stationNumero, string $fuelType, Collection $competitors): ?int
    {
        $yesterday = now()->subDay()->format('Y-m-d');
        $cacheKey = "ranking:{$stationNumero}:{$fuelType}:{$yesterday}";

        return Cache::get($cacheKey);
    }

    protected function determineTrend(int $currentRank, ?int $yesterdayRank): string
    {
        if ($yesterdayRank === null) {
            return 'new';
        }

        if ($currentRank < $yesterdayRank) {
            return 'improving';
        } elseif ($currentRank > $yesterdayRank) {
            return 'worsening';
        }

        return 'maintaining';
    }

    protected function determinePosition(float $percentile): string
    {
        if ($percentile === 0) {
            return 'cheapest';
        } elseif ($percentile <= 25) {
            return 'very_competitive';
        } elseif ($percentile <= 50) {
            return 'competitive';
        } elseif ($percentile <= 75) {
            return 'above_average';
        } else {
            return 'expensive';
        }
    }

    protected function emptyRanking(string $fuelType): array
    {
        return [
            'rank' => null,
            'total' => 0,
            'percentile' => null,
            'price' => null,
            'diff_from_first' => null,
            'position' => 'no_data',
            'trend' => 'unknown',
            'yesterday_rank' => null,
        ];
    }

    public function getOverallPosition(array $rankings): string
    {
        $positions = [];

        foreach ($rankings as $fuelType => $ranking) {
            if ($ranking['position'] !== 'no_data') {
                $positions[] = $ranking['position'];
            }
        }

        if (empty($positions)) {
            return 'no_data';
        }

        $positionCounts = array_count_values($positions);

        if (isset($positionCounts['cheapest']) && $positionCounts['cheapest'] >= 2) {
            return 'very_competitive';
        }

        if (isset($positionCounts['expensive']) && $positionCounts['expensive'] >= 2) {
            return 'expensive';
        }

        if (isset($positionCounts['competitive']) || isset($positionCounts['very_competitive'])) {
            return 'competitive';
        }

        return 'mixed';
    }
}
