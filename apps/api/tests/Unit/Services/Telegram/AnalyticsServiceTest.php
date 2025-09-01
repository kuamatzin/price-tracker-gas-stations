<?php

namespace Tests\Unit\Services\Telegram;

use Tests\TestCase;
use App\Services\Telegram\AnalyticsService;
use App\Repositories\PriceRepository;
use App\Repositories\StationRepository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Mockery;

class AnalyticsServiceTest extends TestCase
{
    private AnalyticsService $service;
    private $priceRepository;
    private $stationRepository;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->priceRepository = Mockery::mock(PriceRepository::class);
        $this->stationRepository = Mockery::mock(StationRepository::class);
        
        $this->service = new AnalyticsService(
            $this->priceRepository,
            $this->stationRepository
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_calculate_statistics_with_valid_data()
    {
        $prices = [22.5, 23.0, 22.8, 23.2, 22.6];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('calculateStatistics');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('average', $result);
        $this->assertArrayHasKey('median', $result);
        $this->assertArrayHasKey('std_deviation', $result);
        $this->assertArrayHasKey('min', $result);
        $this->assertArrayHasKey('max', $result);
        
        $this->assertEquals(22.82, $result['average']);
        $this->assertEquals(22.8, $result['median']);
        $this->assertEquals(22.5, $result['min']);
        $this->assertEquals(23.2, $result['max']);
    }

    public function test_calculate_statistics_with_empty_array()
    {
        $prices = [];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('calculateStatistics');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals(0, $result['average']);
        $this->assertEquals(0, $result['median']);
        $this->assertEquals(0, $result['std_deviation']);
        $this->assertEquals(0, $result['min']);
        $this->assertEquals(0, $result['max']);
    }

    public function test_get_trend_direction_rising()
    {
        $prices = [20.0, 20.5, 21.0, 21.5, 22.0, 22.5];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('getTrendDirection');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals('rising', $result);
    }

    public function test_get_trend_direction_falling()
    {
        $prices = [22.5, 22.0, 21.5, 21.0, 20.5, 20.0];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('getTrendDirection');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals('falling', $result);
    }

    public function test_get_trend_direction_stable()
    {
        $prices = [22.0, 22.05, 21.98, 22.02, 21.99, 22.01];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('getTrendDirection');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals('stable', $result);
    }

    public function test_generate_ranking_recommendation_excellent_position()
    {
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('generateRankingRecommendation');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, 1, 10, 22.50, 23.00);
        
        $this->assertStringContainsString('Excelente posición', $result);
    }

    public function test_generate_ranking_recommendation_weak_position()
    {
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('generateRankingRecommendation');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, 8, 10, 24.00, 22.50);
        
        $this->assertStringContainsString('Posición débil', $result);
    }

    public function test_generate_ranking_recommendation_critical_position()
    {
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('generateRankingRecommendation');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, 10, 10, 25.00, 22.50);
        
        $this->assertStringContainsString('Posición crítica', $result);
    }

    public function test_get_price_trends_uses_cache()
    {
        $stationNumero = 'TEST123';
        $days = 7;
        $radiusKm = 5;
        
        $station = (object)[
            'numero' => $stationNumero,
            'lat' => 19.4326,
            'lng' => -99.1332
        ];
        
        $this->stationRepository->shouldReceive('getByNumero')
            ->once()
            ->with($stationNumero)
            ->andReturn($station);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturn([
                'station_numero' => $stationNumero,
                'trends' => [],
                'generated_at' => now()->toIso8601String()
            ]);
        
        $result = $this->service->getPriceTrends($stationNumero, $days, $radiusKm);
        
        $this->assertIsArray($result);
        $this->assertEquals($stationNumero, $result['station_numero']);
    }

    public function test_get_competitor_ranking_calculates_percentile()
    {
        $stationNumero = 'TEST123';
        $radiusKm = 5;
        
        $station = (object)[
            'numero' => $stationNumero,
            'lat' => 19.4326,
            'lng' => -99.1332
        ];
        
        $this->stationRepository->shouldReceive('getByNumero')
            ->once()
            ->with($stationNumero)
            ->andReturn($station);
        
        Cache::shouldReceive('remember')
            ->once()
            ->andReturnUsing(function ($key, $ttl, $callback) {
                // Mock the callback execution
                DB::shouldReceive('table->select->addBinding->where->having->get')
                    ->andReturn(collect([]));
                
                DB::shouldReceive('table->select->join->whereIn->whereRaw->get')
                    ->andReturn(collect([
                        (object)['station_numero' => 'TEST123', 'fuel_type' => 'regular', 'price' => 22.50, 'station_name' => 'Test Station', 'brand' => 'Test Brand'],
                        (object)['station_numero' => 'COMP1', 'fuel_type' => 'regular', 'price' => 22.00, 'station_name' => 'Competitor 1', 'brand' => 'Brand 1'],
                        (object)['station_numero' => 'COMP2', 'fuel_type' => 'regular', 'price' => 23.00, 'station_name' => 'Competitor 2', 'brand' => 'Brand 2'],
                    ]));
                
                return $callback();
            });
        
        $result = $this->service->getCompetitorRanking($stationNumero, $radiusKm);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('rankings', $result);
        
        if (!empty($result['rankings']['regular'])) {
            $ranking = $result['rankings']['regular'];
            $this->assertArrayHasKey('position', $ranking);
            $this->assertArrayHasKey('percentile', $ranking);
            $this->assertEquals(2, $ranking['position']);
            $this->assertEquals(67, $ranking['percentile']); // (3-2+1)/3 * 100 = 67%
        }
    }

    public function test_calculate_median_with_even_count()
    {
        $prices = [20.0, 21.0, 22.0, 23.0];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('calculateStatistics');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals(21.5, $result['median']); // (21.0 + 22.0) / 2
    }

    public function test_calculate_median_with_odd_count()
    {
        $prices = [20.0, 21.0, 22.0, 23.0, 24.0];
        
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('calculateStatistics');
        $method->setAccessible(true);
        
        $result = $method->invoke($this->service, $prices);
        
        $this->assertEquals(22.0, $result['median']);
    }
}