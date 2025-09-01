<?php

namespace App\Services;

use App\Models\Station;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SpreadAnalysisService
{
    protected array $fuelTypes = ['regular', 'premium', 'diesel'];

    public function analyzeAllFuelTypes(Station $userStation, Collection $competitors): array
    {
        $analysis = [];

        foreach ($this->fuelTypes as $fuelType) {
            $analysis[$fuelType] = $this->analyzeSpread($userStation, $competitors, $fuelType);
        }

        return $analysis;
    }

    public function analyzeSpread(Station $userStation, Collection $competitors, string $fuelType): array
    {
        $prices = $this->collectPrices($competitors, $fuelType);
        $userPrice = $this->getUserPrice($userStation, $fuelType);

        if (empty($prices) || ! $userPrice) {
            return $this->emptyAnalysis();
        }

        $stats = [
            'min' => min($prices),
            'max' => max($prices),
            'avg' => array_sum($prices) / count($prices),
            'median' => $this->calculateMedian($prices),
            'stddev' => $this->calculateStdDev($prices),
            'user_price' => $userPrice,
        ];

        $stats['spread'] = $stats['max'] - $stats['min'];
        $stats['user_position'] = [
            'from_min' => $userPrice - $stats['min'],
            'from_max' => $stats['max'] - $userPrice,
            'from_avg' => $userPrice - $stats['avg'],
            'from_avg_percent' => $stats['avg'] > 0
                ? round((($userPrice - $stats['avg']) / $stats['avg']) * 100, 2)
                : 0,
        ];

        sort($prices);
        $stats['quartiles'] = [
            'q1' => $this->percentile($prices, 25),
            'q2' => $this->percentile($prices, 50),
            'q3' => $this->percentile($prices, 75),
        ];

        $stats['user_quartile'] = $this->determineQuartile($userPrice, $stats['quartiles']);

        $stats['is_outlier'] = $this->isOutlier($userPrice, $stats['avg'], $stats['stddev']);

        return [
            'market' => [
                'min' => round($stats['min'], 2),
                'max' => round($stats['max'], 2),
                'avg' => round($stats['avg'], 2),
                'median' => round($stats['median'], 2),
                'spread' => round($stats['spread'], 2),
                'stddev' => round($stats['stddev'], 2),
            ],
            'position' => [
                'user_price' => round($userPrice, 2),
                'from_min' => round($stats['user_position']['from_min'], 2),
                'from_max' => round($stats['user_position']['from_max'], 2),
                'from_avg' => round($stats['user_position']['from_avg'], 2),
                'from_avg_percent' => $stats['user_position']['from_avg_percent'],
                'quartile' => $stats['user_quartile'],
                'is_outlier' => $stats['is_outlier'],
            ],
            'spread' => $stats,
        ];
    }

    protected function collectPrices(Collection $competitors, string $fuelType): array
    {
        $prices = [];

        foreach ($competitors as $competitor) {
            if (isset($competitor['prices'][$fuelType]) && $competitor['prices'][$fuelType] !== null) {
                $prices[] = $competitor['prices'][$fuelType];
            }
        }

        return $prices;
    }

    protected function getUserPrice(Station $userStation, string $fuelType): ?float
    {
        $price = DB::table('price_changes')
            ->where('station_numero', $userStation->numero)
            ->where('fuel_type', $fuelType)
            ->orderBy('changed_at', 'desc')
            ->first();

        return $price ? $price->price : null;
    }

    protected function calculateMedian(array $prices): float
    {
        sort($prices);
        $count = count($prices);

        if ($count === 0) {
            return 0;
        }

        $middle = floor(($count - 1) / 2);

        if ($count % 2) {
            return $prices[$middle];
        } else {
            return ($prices[$middle] + $prices[$middle + 1]) / 2;
        }
    }

    protected function calculateStdDev(array $prices): float
    {
        $count = count($prices);

        if ($count === 0) {
            return 0;
        }

        $mean = array_sum($prices) / $count;
        $variance = 0;

        foreach ($prices as $price) {
            $variance += pow($price - $mean, 2);
        }

        $variance = $variance / $count;

        return sqrt($variance);
    }

    protected function percentile(array $prices, float $percentile): float
    {
        $count = count($prices);

        if ($count === 0) {
            return 0;
        }

        sort($prices);
        $index = ($percentile / 100) * ($count - 1);
        $lower = floor($index);
        $upper = ceil($index);
        $weight = $index - $lower;

        if ($lower === $upper) {
            return $prices[$lower];
        }

        return $prices[$lower] * (1 - $weight) + $prices[$upper] * $weight;
    }

    protected function determineQuartile(float $userPrice, array $quartiles): string
    {
        if ($userPrice <= $quartiles['q1']) {
            return 'Q1';
        } elseif ($userPrice <= $quartiles['q2']) {
            return 'Q2';
        } elseif ($userPrice <= $quartiles['q3']) {
            return 'Q3';
        } else {
            return 'Q4';
        }
    }

    protected function isOutlier(float $price, float $mean, float $stddev): bool
    {
        if ($stddev === 0) {
            return false;
        }

        return abs($price - $mean) > (2 * $stddev);
    }

    protected function emptyAnalysis(): array
    {
        return [
            'market' => [
                'min' => null,
                'max' => null,
                'avg' => null,
                'median' => null,
                'spread' => null,
                'stddev' => null,
            ],
            'position' => [
                'user_price' => null,
                'from_min' => null,
                'from_max' => null,
                'from_avg' => null,
                'from_avg_percent' => null,
                'quartile' => null,
                'is_outlier' => false,
            ],
            'spread' => [],
        ];
    }
}
