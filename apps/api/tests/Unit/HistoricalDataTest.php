<?php

namespace Tests\Unit;

use App\Services\ChartFormatterService;
use App\Services\TrendAnalysisService;
use Tests\TestCase;

class HistoricalDataTest extends TestCase
{
    private TrendAnalysisService $trendService;

    private ChartFormatterService $chartFormatter;

    protected function setUp(): void
    {
        parent::setUp();
        $this->trendService = new TrendAnalysisService(
            $this->createMock(\App\Repositories\HistoricalDataRepository::class)
        );
        $this->chartFormatter = new ChartFormatterService;
    }

    public function test_volatility_calculation_is_accurate(): void
    {
        $prices = [22.5, 22.8, 23.1, 22.9, 23.3, 22.7];
        $volatility = $this->trendService->calculateVolatility($prices);

        // Expected standard deviation is approximately 0.261
        $this->assertEqualsWithDelta(0.261, $volatility, 0.01);
    }

    public function test_trend_direction_detection(): void
    {
        // Rising trend
        $risingPrices = [20.0, 20.5, 21.0, 21.5, 22.0];
        $risingTrend = $this->trendService->calculateTrend($risingPrices);
        $this->assertEquals('rising', $risingTrend['direction']);
        $this->assertGreaterThan(0, $risingTrend['slope']);

        // Falling trend
        $fallingPrices = [22.0, 21.5, 21.0, 20.5, 20.0];
        $fallingTrend = $this->trendService->calculateTrend($fallingPrices);
        $this->assertEquals('falling', $fallingTrend['direction']);
        $this->assertLessThan(0, $fallingTrend['slope']);

        // Stable trend
        $stablePrices = [22.0, 22.01, 21.99, 22.0, 22.0];
        $stableTrend = $this->trendService->calculateTrend($stablePrices);
        $this->assertEquals('stable', $stableTrend['direction']);
    }

    public function test_chart_data_formatting(): void
    {
        $historyData = [
            'station' => ['numero' => '12345', 'nombre' => 'Test Station'],
            'period' => ['start' => '2024-01-01', 'end' => '2024-01-07'],
            'series' => [
                'regular' => [
                    ['date' => '2024-01-01', 'price' => 22.45, 'change' => 0],
                    ['date' => '2024-01-02', 'price' => 22.89, 'change' => 0.44],
                ],
                'premium' => [
                    ['date' => '2024-01-01', 'price' => 24.12, 'change' => 0],
                    ['date' => '2024-01-02', 'price' => 24.12, 'change' => 0],
                ],
            ],
            'summary' => ['total_changes' => 1, 'avg_change_percent' => 1.96],
        ];

        $formatted = $this->chartFormatter->formatTimeSeries($historyData, 'daily');

        $this->assertArrayHasKey('chart_data', $formatted);
        $this->assertArrayHasKey('chart_config', $formatted);
        $this->assertIsArray($formatted['chart_data']);
        $this->assertCount(2, $formatted['chart_data']);

        // Check chart data structure
        $firstPoint = $formatted['chart_data'][0];
        $this->assertArrayHasKey('date', $firstPoint);
        $this->assertArrayHasKey('regular', $firstPoint);
        $this->assertArrayHasKey('premium', $firstPoint);
    }

    public function test_handles_empty_price_data(): void
    {
        $emptyPrices = [];
        $volatility = $this->trendService->calculateVolatility($emptyPrices);
        $this->assertEquals(0, $volatility);

        $trend = $this->trendService->calculateTrend($emptyPrices);
        $this->assertEquals('stable', $trend['direction']);
        $this->assertEquals(0, $trend['slope']);
    }

    public function test_handles_single_price_point(): void
    {
        $singlePrice = [22.5];
        $volatility = $this->trendService->calculateVolatility($singlePrice);
        $this->assertEquals(0, $volatility);

        $trend = $this->trendService->calculateTrend($singlePrice);
        $this->assertEquals('stable', $trend['direction']);
    }
}
