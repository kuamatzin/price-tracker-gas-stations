<?php

namespace App\Services;

use App\Models\Station;
use App\Repositories\HistoricalDataRepository;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TrendAnalysisService
{
    public function __construct(
        private HistoricalDataRepository $historicalRepo
    ) {}

    public function calculateStationTrends(
        string $stationId,
        string $startDate,
        string $endDate,
        int $periodDays = 7
    ): array {
        $station = Station::where('numero', $stationId)->first();
        if (! $station) {
            return [
                'station' => null,
                'period' => ['start' => $startDate, 'end' => $endDate, 'days' => 0],
                'trends' => [],
            ];
        }

        $priceData = $this->getPriceDataForPeriod($stationId, $startDate, $endDate);
        $marketAvg = $this->getMarketAverage($station->municipio_id, $startDate, $endDate);

        $trends = [];
        $fuelTypes = ['regular', 'premium', 'diesel'];

        foreach ($fuelTypes as $fuelType) {
            $fuelPrices = $priceData->where('fuel_type', $fuelType);

            if ($fuelPrices->isEmpty()) {
                continue;
            }

            $prices = $fuelPrices->pluck('price')->toArray();
            $trends[$fuelType] = $this->analyzeFuelTrend($prices, $fuelPrices, $marketAvg[$fuelType] ?? null);
        }

        return [
            'station' => [
                'numero' => $station->numero,
                'nombre' => $station->nombre,
            ],
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
                'days' => Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)),
            ],
            'trends' => $trends,
        ];
    }

    private function getPriceDataForPeriod(string $stationId, string $startDate, string $endDate)
    {
        return DB::table('price_changes')
            ->where('station_numero', $stationId)
            ->whereBetween('changed_at', [$startDate.' 00:00:00', $endDate.' 23:59:59'])
            ->orderBy('changed_at')
            ->get();
    }

    private function getMarketAverage($municipioId, string $startDate, string $endDate): array
    {
        $avgPrices = DB::table('price_changes as pc')
            ->join('stations as s', 'pc.station_numero', '=', 's.numero')
            ->select(
                'pc.fuel_type',
                DB::raw('AVG(pc.price) as avg_price')
            )
            ->where('s.municipio_id', $municipioId)
            ->whereBetween('pc.changed_at', [$startDate.' 00:00:00', $endDate.' 23:59:59'])
            ->groupBy('pc.fuel_type')
            ->get()
            ->keyBy('fuel_type')
            ->map(fn ($item) => $item->avg_price)
            ->toArray();

        return $avgPrices;
    }

    private function analyzeFuelTrend(array $prices, $priceData, ?float $marketAvg): array
    {
        $currentPrice = end($prices);
        $avgPrice = array_sum($prices) / count($prices);

        // Find min and max with dates
        $minData = $priceData->sortBy('price')->first();
        $maxData = $priceData->sortByDesc('price')->first();

        // Calculate volatility (standard deviation)
        $volatility = $this->calculateVolatility($prices);

        // Calculate trend direction
        $trendAnalysis = $this->calculateTrend($prices);

        // Calculate percentage change
        $firstPrice = reset($prices);
        $changePercent = $firstPrice > 0 ? (($currentPrice - $firstPrice) / $firstPrice) * 100 : 0;

        // Compare to market
        $vsMarket = null;
        if ($marketAvg !== null) {
            $difference = $currentPrice - $marketAvg;
            $percent = $marketAvg > 0 ? ($difference / $marketAvg) * 100 : 0;
            $vsMarket = [
                'difference' => round($difference, 2),
                'percent' => round($percent, 2),
                'position' => $difference > 0 ? 'above' : ($difference < 0 ? 'below' : 'equal'),
            ];
        }

        return [
            'current' => round($currentPrice, 2),
            'avg' => round($avgPrice, 2),
            'min' => [
                'price' => round($minData->price, 2),
                'date' => Carbon::parse($minData->changed_at)->format('Y-m-d'),
            ],
            'max' => [
                'price' => round($maxData->price, 2),
                'date' => Carbon::parse($maxData->changed_at)->format('Y-m-d'),
            ],
            'volatility' => round($volatility, 2),
            'trend' => $trendAnalysis['direction'],
            'slope' => round($trendAnalysis['slope'], 3),
            'confidence' => round($trendAnalysis['confidence'], 2),
            'change_percent' => round($changePercent, 2),
            'vs_market' => $vsMarket,
            'moving_avg_7d' => $this->calculateMovingAverage($prices, 7),
            'sample_size' => count($prices),
        ];
    }

    public function calculateVolatility(array $prices): float
    {
        if (count($prices) < 2) {
            return 0;
        }

        // Check for identical prices (no volatility)
        if (count(array_unique($prices)) === 1) {
            return 0;
        }

        $mean = array_sum($prices) / count($prices);
        $variance = array_reduce($prices, function ($carry, $price) use ($mean) {
            return $carry + pow($price - $mean, 2);
        }, 0) / count($prices);

        return sqrt($variance);
    }

    public function calculateTrend(array $prices): array
    {
        if (count($prices) < 2) {
            return ['direction' => 'stable', 'slope' => 0, 'confidence' => 0];
        }

        // Check for identical prices (no trend)
        if (count(array_unique($prices)) === 1) {
            return ['direction' => 'stable', 'slope' => 0, 'confidence' => 1.0];
        }

        $n = count($prices);
        $x = range(0, $n - 1);
        $y = array_values($prices);

        $x_mean = array_sum($x) / $n;
        $y_mean = array_sum($y) / $n;

        $num = 0;
        $den = 0;

        for ($i = 0; $i < $n; $i++) {
            $num += ($x[$i] - $x_mean) * ($y[$i] - $y_mean);
            $den += pow($x[$i] - $x_mean, 2);
        }

        // Handle edge case where all x values are the same (shouldn't happen with range, but safety check)
        if ($den == 0) {
            return ['direction' => 'stable', 'slope' => 0, 'confidence' => 0];
        }

        $slope = $num / $den;
        $r2 = $this->calculateR2($x, $y, $slope, $y_mean);

        return [
            'direction' => $slope > 0.01 ? 'rising' : ($slope < -0.01 ? 'falling' : 'stable'),
            'slope' => round($slope, 4),
            'confidence' => $r2,
        ];
    }

    private function calculateR2(array $x, array $y, float $slope, float $yMean): float
    {
        $n = count($x);
        if ($n < 2) {
            return 0;
        }

        // Check for identical y values (perfect fit for horizontal line)
        if (count(array_unique($y)) === 1) {
            return 1.0;
        }

        $xMean = array_sum($x) / $n;
        $intercept = $yMean - $slope * $xMean;

        $ssRes = 0;
        $ssTot = 0;

        for ($i = 0; $i < $n; $i++) {
            $yPred = $slope * $x[$i] + $intercept;
            $ssRes += pow($y[$i] - $yPred, 2);
            $ssTot += pow($y[$i] - $yMean, 2);
        }

        // Handle edge case where all y values are the same (ssTot = 0)
        if ($ssTot == 0) {
            // If residuals are also 0, it's a perfect fit
            return $ssRes == 0 ? 1.0 : 0;
        }

        $r2 = 1 - ($ssRes / $ssTot);

        // Ensure R² is between 0 and 1 (floating point errors can cause slight deviations)
        return max(0, min(1, round($r2, 4)));
    }

    private function calculateMovingAverage(array $prices, int $window): ?float
    {
        if (count($prices) < $window) {
            return null;
        }

        $recentPrices = array_slice($prices, -$window);

        return round(array_sum($recentPrices) / count($recentPrices), 2);
    }

    public function detectSeasonalPatterns(array $historicalData): array
    {
        // Analyze weekly patterns
        $weeklyPattern = $this->analyzeWeeklyPattern($historicalData);

        // Analyze monthly patterns
        $monthlyPattern = $this->analyzeMonthlyPattern($historicalData);

        return [
            'weekly' => $weeklyPattern,
            'monthly' => $monthlyPattern,
            'has_pattern' => $weeklyPattern['significant'] || $monthlyPattern['significant'],
        ];
    }

    private function analyzeWeeklyPattern(array $data): array
    {
        if (empty($data)) {
            return [
                'pattern' => [],
                'variance' => 0,
                'significant' => false,
            ];
        }

        $dayAverages = [];

        foreach ($data as $item) {
            if (isset($item['date']) && isset($item['price'])) {
                $dayOfWeek = Carbon::parse($item['date'])->dayOfWeek;
                $dayAverages[$dayOfWeek][] = $item['price'];
            }
        }

        $pattern = [];
        foreach ($dayAverages as $day => $prices) {
            if (! empty($prices)) {
                $pattern[$day] = array_sum($prices) / count($prices);
            }
        }

        $variance = count($pattern) > 1 ? $this->calculateVolatility(array_values($pattern)) : 0;

        return [
            'pattern' => $pattern,
            'variance' => round($variance, 4),
            'significant' => $variance > 0.5,
        ];
    }

    private function analyzeMonthlyPattern(array $data): array
    {
        if (empty($data)) {
            return [
                'pattern' => [],
                'variance' => 0,
                'significant' => false,
            ];
        }

        $monthAverages = [];

        foreach ($data as $item) {
            if (isset($item['date']) && isset($item['price'])) {
                $month = Carbon::parse($item['date'])->month;
                $monthAverages[$month][] = $item['price'];
            }
        }

        $pattern = [];
        foreach ($monthAverages as $month => $prices) {
            if (! empty($prices)) {
                $pattern[$month] = array_sum($prices) / count($prices);
            }
        }

        $variance = count($pattern) > 1 ? $this->calculateVolatility(array_values($pattern)) : 0;

        return [
            'pattern' => $pattern,
            'variance' => round($variance, 4),
            'significant' => $variance > 1.0,
        ];
    }
}
