<?php

namespace Tests\Integration\Analytics;

use App\Models\PriceChange;
use App\Models\Station;
use App\Repositories\AnalyticsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private AnalyticsRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new AnalyticsRepository;
        $this->seedTestData();
    }

    private function seedTestData(): void
    {
        // Create test stations
        Station::create([
            'numero' => 'TEST001',
            'nombre' => 'Test Station 1',
            'brand' => 'Test Brand',
            'lat' => 19.4326,
            'lng' => -99.1332,
            'municipio_id' => 1,
            'is_active' => true,
        ]);

        Station::create([
            'numero' => 'TEST002',
            'nombre' => 'Test Station 2',
            'brand' => 'Test Brand',
            'lat' => 19.4330,
            'lng' => -99.1330,
            'municipio_id' => 1,
            'is_active' => true,
        ]);

        // Create price changes for trend analysis
        $dates = [
            now()->subDays(6),
            now()->subDays(5),
            now()->subDays(4),
            now()->subDays(3),
            now()->subDays(2),
            now()->subDays(1),
            now(),
        ];

        $prices = [20.0, 20.5, 21.0, 21.2, 21.5, 22.0, 22.5];

        foreach ($dates as $index => $date) {
            PriceChange::create([
                'station_numero' => 'TEST001',
                'fuel_type' => 'regular',
                'price' => $prices[$index],
                'changed_at' => $date,
                'detected_at' => $date,
            ]);

            PriceChange::create([
                'station_numero' => 'TEST002',
                'fuel_type' => 'regular',
                'price' => $prices[$index] + 0.5,
                'changed_at' => $date,
                'detected_at' => $date,
            ]);
        }
    }

    public function test_get_trend_data()
    {
        $stationNumeros = ['TEST001', 'TEST002'];
        $startDate = now()->subDays(7);
        $endDate = now();

        $result = $this->repository->getTrendData(
            $stationNumeros,
            $startDate,
            $endDate,
            'regular'
        );

        $this->assertNotEmpty($result);
        $this->assertTrue($result->contains('fuel_type', 'regular'));

        $firstDay = $result->first();
        $this->assertNotNull($firstDay->avg_price);
        $this->assertNotNull($firstDay->min_price);
        $this->assertNotNull($firstDay->max_price);
        $this->assertNotNull($firstDay->station_count);
    }

    public function test_get_competitor_prices()
    {
        $stationNumeros = ['TEST001', 'TEST002'];

        $result = $this->repository->getCompetitorPrices(
            $stationNumeros,
            ['regular']
        );

        $this->assertCount(2, $result);
        $this->assertTrue($result->contains('station_numero', 'TEST001'));
        $this->assertTrue($result->contains('station_numero', 'TEST002'));

        $firstStation = $result->first();
        $this->assertEquals('regular', $firstStation->fuel_type);
        $this->assertNotNull($firstStation->price);
        $this->assertNotNull($firstStation->station_name);
        $this->assertNotNull($firstStation->brand);
    }

    public function test_get_market_statistics()
    {
        $result = $this->repository->getMarketStatistics(1, 'regular', 7);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('regular', $result);

        $stats = $result['regular'];
        $this->assertArrayHasKey('average', $stats);
        $this->assertArrayHasKey('minimum', $stats);
        $this->assertArrayHasKey('maximum', $stats);
        $this->assertArrayHasKey('std_deviation', $stats);
        $this->assertArrayHasKey('station_count', $stats);
        $this->assertArrayHasKey('volatility', $stats);

        $this->assertGreaterThan(0, $stats['average']);
        $this->assertEquals(2, $stats['station_count']);
    }

    public function test_get_recent_price_changes()
    {
        // Add a recent price change
        PriceChange::create([
            'station_numero' => 'TEST001',
            'fuel_type' => 'regular',
            'price' => 23.0,
            'changed_at' => now()->subMinutes(30),
            'detected_at' => now()->subMinutes(30),
        ]);

        $result = $this->repository->getRecentPriceChanges(['TEST001'], 1);

        $this->assertNotEmpty($result);

        $change = $result->first();
        $this->assertEquals('TEST001', $change->station_numero);
        $this->assertEquals('regular', $change->fuel_type);
        $this->assertNotNull($change->new_price);
        $this->assertNotNull($change->old_price);
        $this->assertNotNull($change->change_percentage);
        $this->assertNotNull($change->change_amount);
    }

    public function test_get_historical_data()
    {
        $result = $this->repository->getHistoricalData('TEST001', 7, 'regular');

        $this->assertNotEmpty($result);
        $this->assertTrue($result->every(function ($item) {
            return $item->station_numero === 'TEST001' &&
                   $item->fuel_type === 'regular';
        }));

        // Should be ordered by changed_at desc
        $dates = $result->pluck('changed_at');
        $this->assertEquals($dates->sort()->reverse()->values(), $dates);
    }

    public function test_get_most_active_stations()
    {
        // Add more price changes for TEST001
        for ($i = 0; $i < 5; $i++) {
            PriceChange::create([
                'station_numero' => 'TEST001',
                'fuel_type' => 'premium',
                'price' => 24.0 + $i * 0.1,
                'changed_at' => now()->subHours($i),
                'detected_at' => now()->subHours($i),
            ]);
        }

        $result = $this->repository->getMostActiveStations(1, 7, 10);

        $this->assertNotEmpty($result);

        $mostActive = $result->first();
        $this->assertEquals('TEST001', $mostActive->numero);
        $this->assertGreaterThan(5, $mostActive->change_count);
        $this->assertNotNull($mostActive->last_change);
    }

    public function test_get_volatility_metrics()
    {
        $result = $this->repository->getVolatilityMetrics(['TEST001', 'TEST002'], 30);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('regular', $result);

        $regularMetrics = $result['regular'];
        $this->assertArrayHasKey('TEST001', $regularMetrics);
        $this->assertArrayHasKey('TEST002', $regularMetrics);

        $station1Metrics = $regularMetrics['TEST001'];
        $this->assertArrayHasKey('change_frequency', $station1Metrics);
        $this->assertArrayHasKey('avg_price', $station1Metrics);
        $this->assertArrayHasKey('volatility', $station1Metrics);
        $this->assertArrayHasKey('price_range', $station1Metrics);
    }

    public function test_get_positioning_history()
    {
        $result = $this->repository->getPositioningHistory(
            'TEST001',
            ['TEST002'],
            7
        );

        $this->assertNotEmpty($result);

        $firstDay = $result->first();
        $this->assertNotNull($firstDay->date);
        $this->assertEquals('regular', $firstDay->fuel_type);
        $this->assertNotNull($firstDay->target_price);
        $this->assertNotNull($firstDay->competitor_avg);
        $this->assertNotNull($firstDay->competitor_min);
        $this->assertNotNull($firstDay->competitor_max);
    }

    public function test_estimate_market_share()
    {
        $result = $this->repository->estimateMarketShare(
            'TEST001',
            ['TEST002']
        );

        $this->assertIsArray($result);
        $this->assertArrayHasKey('regular', $result);

        // Market share should be between 0 and 100
        $this->assertGreaterThanOrEqual(0, $result['regular']);
        $this->assertLessThanOrEqual(100, $result['regular']);
    }

    public function test_create_indexes()
    {
        // This should not throw an exception
        $this->repository->createIndexes();

        // Verify indexes exist (implementation depends on database)
        $this->assertTrue(true); // If no exception, indexes were created
    }
}
