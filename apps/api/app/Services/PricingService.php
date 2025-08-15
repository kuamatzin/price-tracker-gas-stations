<?php

namespace App\Services;

class PricingService
{
    public function calculatePriceChangePercentage(?float $oldPrice, float $newPrice): float
    {
        if (! $oldPrice || $oldPrice <= 0) {
            return 0.0;
        }

        return round((($newPrice - $oldPrice) / $oldPrice) * 100, 2);
    }

    public function determinePriceTrend(?float $oldPrice, float $newPrice): string
    {
        if (! $oldPrice || $oldPrice <= 0) {
            return 'stable';
        }

        if ($newPrice > $oldPrice) {
            return 'up';
        } elseif ($newPrice < $oldPrice) {
            return 'down';
        }

        return 'stable';
    }

    public function formatPrice(float $price): float
    {
        return round($price, 2);
    }

    public function comparePrices(float $price1, float $price2, int $precision = 2): int
    {
        $rounded1 = round($price1, $precision);
        $rounded2 = round($price2, $precision);

        if ($rounded1 > $rounded2) {
            return 1;
        } elseif ($rounded1 < $rounded2) {
            return -1;
        }

        return 0;
    }

    public function getPriceRange(array $prices): array
    {
        if (empty($prices)) {
            return ['min' => 0, 'max' => 0, 'avg' => 0];
        }

        $min = min($prices);
        $max = max($prices);
        $avg = array_sum($prices) / count($prices);

        return [
            'min' => $this->formatPrice($min),
            'max' => $this->formatPrice($max),
            'avg' => $this->formatPrice($avg),
        ];
    }

    public function isSignificantPriceChange(float $changePercent, float $threshold = 2.0): bool
    {
        return abs($changePercent) >= $threshold;
    }

    public function calculateDistanceInKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // Earth's radius in kilometers

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }
}
