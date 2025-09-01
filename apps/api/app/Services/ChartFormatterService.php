<?php

namespace App\Services;

class ChartFormatterService
{
    public function formatTimeSeries(array $historyData, string $grouping = 'daily'): array
    {
        if (! $historyData['station']) {
            return $historyData;
        }

        // Transform series data for chart consumption
        $chartData = $this->transformToChartFormat($historyData['series']);

        // Add metadata for chart rendering
        $historyData['chart_data'] = $chartData;
        $historyData['chart_config'] = $this->getChartConfig($grouping);

        return $historyData;
    }

    private function transformToChartFormat(array $series): array
    {
        $chartData = [];
        $dates = [];

        // Collect all unique dates
        foreach ($series as $fuelType => $dataPoints) {
            foreach ($dataPoints as $point) {
                $dates[$point['date']] = true;
            }
        }

        // Sort dates
        $dates = array_keys($dates);
        sort($dates);

        // Build chart data with all fuel types for each date
        foreach ($dates as $date) {
            $dataPoint = ['date' => $date];

            foreach ($series as $fuelType => $fuelData) {
                $dayData = collect($fuelData)->firstWhere('date', $date);
                $dataPoint[$fuelType] = $dayData ? $dayData['price'] : null;

                // Add change indicators
                if ($dayData && $dayData['change'] != 0) {
                    $dataPoint['events'][] = [
                        'type' => 'price_change',
                        'fuel' => $fuelType,
                        'change' => $dayData['change'],
                    ];
                }
            }

            $chartData[] = $dataPoint;
        }

        return $chartData;
    }

    private function getChartConfig(string $grouping): array
    {
        return [
            'type' => 'line',
            'x_axis' => [
                'key' => 'date',
                'label' => $this->getAxisLabel($grouping),
                'format' => $this->getDateFormat($grouping),
            ],
            'y_axis' => [
                'label' => 'Precio (MXN)',
                'format' => 'currency',
            ],
            'series' => [
                ['key' => 'regular', 'color' => '#10b981', 'label' => 'Regular'],
                ['key' => 'premium', 'color' => '#f59e0b', 'label' => 'Premium'],
                ['key' => 'diesel', 'color' => '#3b82f6', 'label' => 'Diésel'],
            ],
            'tooltip' => [
                'format' => 'currency',
                'show_change' => true,
            ],
        ];
    }

    private function getAxisLabel(string $grouping): string
    {
        return match ($grouping) {
            'hourly' => 'Hora',
            'daily' => 'Fecha',
            'weekly' => 'Semana',
            'monthly' => 'Mes',
            default => 'Fecha'
        };
    }

    private function getDateFormat(string $grouping): string
    {
        return match ($grouping) {
            'hourly' => 'HH:mm',
            'daily' => 'DD/MM',
            'weekly' => 'Semana WW',
            'monthly' => 'MMM YYYY',
            default => 'DD/MM/YYYY'
        };
    }

    public function formatComparison(array $data): array
    {
        return [
            'type' => 'bar',
            'data' => $data,
            'config' => [
                'x_axis' => ['key' => 'station', 'label' => 'Estación'],
                'y_axis' => ['key' => 'price', 'label' => 'Precio (MXN)'],
                'colors' => ['#10b981', '#f59e0b', '#3b82f6'],
            ],
        ];
    }

    public function formatTrendChart(array $trendData): array
    {
        $chartData = [];

        foreach ($trendData as $period => $metrics) {
            $chartData[] = [
                'period' => $period,
                'avg' => $metrics['avg'] ?? null,
                'min' => $metrics['min']['price'] ?? null,
                'max' => $metrics['max']['price'] ?? null,
                'trend_line' => $metrics['trend_line'] ?? null,
            ];
        }

        return [
            'type' => 'area',
            'data' => $chartData,
            'config' => [
                'x_axis' => ['key' => 'period', 'label' => 'Periodo'],
                'y_axis' => ['key' => 'price', 'label' => 'Precio (MXN)'],
                'series' => [
                    ['key' => 'avg', 'color' => '#10b981', 'label' => 'Promedio'],
                    ['key' => 'min', 'color' => '#3b82f6', 'label' => 'Mínimo', 'type' => 'line'],
                    ['key' => 'max', 'color' => '#ef4444', 'label' => 'Máximo', 'type' => 'line'],
                    ['key' => 'trend_line', 'color' => '#6b7280', 'label' => 'Tendencia', 'type' => 'dashed'],
                ],
            ],
        ];
    }
}
