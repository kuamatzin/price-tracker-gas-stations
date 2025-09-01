<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Cache;

class SparklineGenerator
{
    private const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    private const TREND_UP = '↑';

    private const TREND_DOWN = '↓';

    private const TREND_STABLE = '→';

    /**
     * Generate ASCII sparkline chart for Telegram
     */
    public function generate(
        array $values,
        string $label = '',
        bool $showTrend = true,
        bool $showChange = true
    ): string {
        if (empty($values)) {
            return '';
        }

        $cacheKey = 'sparkline:'.md5(json_encode($values).$label);

        return Cache::remember($cacheKey, 3600, function () use ($values, $label, $showTrend, $showChange) {
            $sparkline = $this->createSparkline($values);
            $trend = $showTrend ? $this->getTrendIndicator($values) : '';
            $change = $showChange ? $this->getChangeText($values) : '';

            $parts = array_filter([
                $label ? "{$label}:" : '',
                $sparkline,
                $trend,
                $change,
            ]);

            return implode(' ', $parts);
        });
    }

    /**
     * Generate multiple sparklines for different fuel types
     */
    public function generateMultiple(array $series, bool $showTrend = true): array
    {
        $result = [];

        foreach ($series as $label => $values) {
            if (! empty($values)) {
                $result[$label] = $this->generate($values, $label, $showTrend);
            }
        }

        return $result;
    }

    /**
     * Create sparkline from values
     */
    private function createSparkline(array $values): string
    {
        // Validate and clean input values
        $values = $this->validateValues($values);

        if (count($values) < 2) {
            return str_repeat(self::SPARK_CHARS[3], max(1, count($values)));
        }

        $min = min($values);
        $max = max($values);
        $range = $max - $min;

        if ($range == 0) {
            // All values are the same
            return str_repeat(self::SPARK_CHARS[3], count($values));
        }

        $sparkline = '';
        foreach ($values as $value) {
            $normalized = ($value - $min) / $range;
            $index = (int) round($normalized * (count(self::SPARK_CHARS) - 1));
            $sparkline .= self::SPARK_CHARS[$index];
        }

        return $sparkline;
    }

    /**
     * Get trend indicator arrow
     */
    private function getTrendIndicator(array $values): string
    {
        if (count($values) < 2) {
            return self::TREND_STABLE;
        }

        $first = reset($values);
        $last = end($values);
        $changePercent = abs(($last - $first) / $first * 100);

        if ($changePercent < 0.5) {
            return self::TREND_STABLE;
        }

        return $last > $first ? self::TREND_UP : self::TREND_DOWN;
    }

    /**
     * Get change text with percentage and values
     */
    private function getChangeText(array $values): string
    {
        if (count($values) < 2) {
            return '';
        }

        $first = reset($values);
        $last = end($values);
        $change = $last - $first;
        $changePercent = ($change / $first) * 100;

        $sign = $change >= 0 ? '+' : '';

        return sprintf(
            '%s%.1f%% ($%.2f → $%.2f)',
            $sign,
            $changePercent,
            $first,
            $last
        );
    }

    /**
     * Format sparkline for table display
     */
    public function formatForTable(
        array $series,
        int $columnWidth = 30
    ): array {
        $formatted = [];

        foreach ($series as $label => $values) {
            if (empty($values)) {
                continue;
            }

            $sparkline = $this->createSparkline($values);
            $trend = $this->getTrendIndicator($values);
            $change = $this->getChangePercentage($values);

            // Pad label to fixed width
            $paddedLabel = str_pad(ucfirst($label), 8);

            // Create the full line
            $line = sprintf(
                '%s %s %s %s',
                $paddedLabel,
                $sparkline,
                $trend,
                $change
            );

            $formatted[] = $line;
        }

        return $formatted;
    }

    /**
     * Get change percentage only
     */
    private function getChangePercentage(array $values): string
    {
        if (count($values) < 2) {
            return '0.0%';
        }

        $first = reset($values);
        $last = end($values);

        if ($first == 0) {
            return '0.0%';
        }

        $changePercent = (($last - $first) / $first) * 100;
        $sign = $changePercent >= 0 ? '+' : '';

        return sprintf('%s%.1f%%', $sign, $changePercent);
    }

    /**
     * Generate comparison sparklines
     */
    public function generateComparison(
        array $yourValues,
        array $competitorValues,
        string $yourLabel = 'Tu estación',
        string $competitorLabel = 'Promedio'
    ): array {
        return [
            $yourLabel => $this->generate($yourValues, $yourLabel),
            $competitorLabel => $this->generate($competitorValues, $competitorLabel),
            'difference' => $this->generateDifferenceChart($yourValues, $competitorValues),
        ];
    }

    /**
     * Generate difference chart between two series
     */
    private function generateDifferenceChart(array $series1, array $series2): string
    {
        $minLength = min(count($series1), count($series2));
        $differences = [];

        for ($i = 0; $i < $minLength; $i++) {
            $differences[] = $series1[$i] - $series2[$i];
        }

        if (empty($differences)) {
            return '';
        }

        // Use positive/negative indicators
        $chart = '';
        foreach ($differences as $diff) {
            if ($diff > 0.5) {
                $chart .= '▲';
            } elseif ($diff < -0.5) {
                $chart .= '▼';
            } else {
                $chart .= '─';
            }
        }

        return "Diferencia: {$chart}";
    }

    /**
     * Create mini sparkline (condensed version)
     */
    public function mini(array $values, int $maxWidth = 8): string
    {
        if (empty($values)) {
            return '';
        }

        // Sample values if too many
        if (count($values) > $maxWidth) {
            $step = ceil(count($values) / $maxWidth);
            $sampled = [];
            for ($i = 0; $i < count($values); $i += $step) {
                $sampled[] = $values[$i];
            }
            $values = $sampled;
        }

        return $this->createSparkline($values);
    }

    /**
     * Validate and clean input values
     */
    private function validateValues(array $values): array
    {
        return array_values(array_filter($values, function ($value) {
            return is_numeric($value) && ! is_nan($value) && ! is_infinite($value);
        }));
    }
}
