<?php

namespace Tests\Feature;

use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CompetitorAnalysisTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Station $userStation;

    protected array $competitors;

    protected function setUp(): void
    {
        parent::setUp();

        // Create required foreign key references
        \DB::table('entidades')->insert([
            'id' => 1,
            'entidad_id' => 1,
            'entidad' => 'Test State',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \DB::table('municipios')->insert([
            ['id' => 1, 'municipio_id' => 1, 'municipio' => 'Test Municipality', 'entidad_id' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'municipio_id' => 2, 'municipio' => 'Different Municipality', 'entidad_id' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->userStation = Station::create([
            'numero' => '12345',
            'nombre' => 'Test Station',
            'lat' => 19.4326,
            'lng' => -99.1332,
            'municipio_id' => 1,
            'entidad_id' => 1,
            'brand' => 'Pemex',
            'is_active' => true,
        ]);

        $this->user = User::factory()->create([
            'station_numero' => $this->userStation->numero,
        ]);

        $this->competitors = [];
        for ($i = 1; $i <= 5; $i++) {
            $competitor = Station::create([
                'numero' => "1234{$i}",
                'nombre' => "Competitor {$i}",
                'lat' => 19.4326 + (0.001 * $i),
                'lng' => -99.1332 + (0.001 * $i),
                'municipio_id' => 1,
                'entidad_id' => 1,
                'brand' => 'Shell',
                'is_active' => true,
            ]);
            $this->competitors[] = $competitor;

            PriceChange::factory()->create([
                'station_numero' => $competitor->numero,
                'fuel_type' => 'regular',
                'price' => 22.00 + (0.1 * $i),
                'changed_at' => now(),
            ]);

            PriceChange::factory()->create([
                'station_numero' => $competitor->numero,
                'fuel_type' => 'premium',
                'price' => 24.00 + (0.1 * $i),
                'changed_at' => now(),
            ]);

            PriceChange::factory()->create([
                'station_numero' => $competitor->numero,
                'fuel_type' => 'diesel',
                'price' => 23.00 + (0.1 * $i),
                'changed_at' => now(),
            ]);
        }

        PriceChange::factory()->create([
            'station_numero' => $this->userStation->numero,
            'fuel_type' => 'regular',
            'price' => 22.30,
            'changed_at' => now(),
        ]);

        PriceChange::factory()->create([
            'station_numero' => $this->userStation->numero,
            'fuel_type' => 'premium',
            'price' => 24.30,
            'changed_at' => now(),
        ]);

        PriceChange::factory()->create([
            'station_numero' => $this->userStation->numero,
            'fuel_type' => 'diesel',
            'price' => 23.30,
            'changed_at' => now(),
        ]);
    }

    public function test_competitors_list_excludes_users_own_station()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/competitors');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'user_station' => ['numero', 'nombre'],
                'settings' => ['mode', 'radius_km'],
                'competitors',
                'total_competitors',
            ],
        ]);

        $competitors = $response->json('data.competitors');
        $stationNumeros = array_column($competitors, 'numero');

        $this->assertNotContains($this->userStation->numero, $stationNumeros);
    }

    public function test_radius_based_detection_works_correctly()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/competitors?mode=radius&radius=2');

        $response->assertStatus(200);

        $competitors = $response->json('data.competitors');

        foreach ($competitors as $competitor) {
            $this->assertLessThanOrEqual(2, $competitor['distance_km']);
        }
    }

    public function test_municipio_based_detection_works_correctly()
    {
        Station::create([
            'numero' => '99999',
            'nombre' => 'Different Municipio',
            'municipio_id' => 2,
            'entidad_id' => 1,
            'brand' => 'BP',
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/competitors?mode=municipio');

        $response->assertStatus(200);

        $competitors = $response->json('data.competitors');
        $stationNumeros = array_column($competitors, 'numero');

        $this->assertNotContains('99999', $stationNumeros);
    }

    public function test_rankings_calculated_correctly_with_ties()
    {
        PriceChange::factory()->create([
            'station_numero' => $this->competitors[0]->numero,
            'fuel_type' => 'regular',
            'price' => 22.30,
            'changed_at' => now()->addMinute(),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/analysis/ranking');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'station' => ['numero', 'nombre'],
                'rankings' => [
                    'regular' => [
                        'rank',
                        'total',
                        'percentile',
                        'price',
                        'diff_from_first',
                        'position',
                        'trend',
                        'yesterday_rank',
                    ],
                ],
                'overall_position',
            ],
        ]);

        $regularRanking = $response->json('data.rankings.regular');
        $this->assertNotNull($regularRanking['rank']);
        $this->assertGreaterThan(0, $regularRanking['total']);
    }

    public function test_spread_analysis_handles_edge_cases()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/analysis/spread');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'analysis' => [
                    'regular' => [
                        'market' => ['min', 'max', 'avg', 'median', 'spread', 'stddev'],
                        'position' => [
                            'user_price',
                            'from_min',
                            'from_max',
                            'from_avg',
                            'from_avg_percent',
                            'quartile',
                            'is_outlier',
                        ],
                    ],
                ],
                'recommendations',
            ],
        ]);

        $regularAnalysis = $response->json('data.analysis.regular');
        $this->assertNotNull($regularAnalysis['market']['min']);
        $this->assertNotNull($regularAnalysis['market']['max']);
        $this->assertGreaterThanOrEqual($regularAnalysis['market']['min'], $regularAnalysis['market']['max']);
    }

    public function test_recommendations_generated_appropriately()
    {
        PriceChange::factory()->create([
            'station_numero' => $this->userStation->numero,
            'fuel_type' => 'regular',
            'price' => 25.00,
            'changed_at' => now()->addMinute(),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/analysis/spread');

        $response->assertStatus(200);

        $recommendations = $response->json('data.recommendations');
        $this->assertIsArray($recommendations);

        if (! empty($recommendations)) {
            $this->assertArrayHasKey('message', $recommendations[0]);
            $this->assertArrayHasKey('priority', $recommendations[0]);
            $this->assertArrayHasKey('suggested_price', $recommendations[0]);
        }
    }

    public function test_cache_works_properly()
    {
        Sanctum::actingAs($this->user);

        $response1 = $this->getJson('/api/v1/competitors');
        $response1->assertStatus(200);

        PriceChange::factory()->create([
            'station_numero' => $this->competitors[0]->numero,
            'fuel_type' => 'regular',
            'price' => 30.00,
            'changed_at' => now()->addMinutes(2),
        ]);

        $response2 = $this->getJson('/api/v1/competitors');
        $response2->assertStatus(200);

        $this->assertEquals(
            $response1->json('data.competitors'),
            $response2->json('data.competitors')
        );
    }

    public function test_competitive_insights_endpoint()
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/analysis/insights');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'pricing_patterns',
                'price_leadership',
                'optimal_windows',
                'market_share_estimate',
                'competitive_alerts',
            ],
        ]);
    }

    public function test_user_without_station_gets_error()
    {
        $userWithoutStation = User::factory()->create([
            'station_numero' => null,
        ]);

        Sanctum::actingAs($userWithoutStation);

        $response = $this->getJson('/api/v1/competitors');

        $response->assertStatus(400);
        $response->assertJson([
            'success' => false,
            'message' => 'User does not have an associated station',
        ]);
    }

    public function test_outlier_detection_works_correctly()
    {
        PriceChange::factory()->create([
            'station_numero' => $this->userStation->numero,
            'fuel_type' => 'regular',
            'price' => 30.00,
            'changed_at' => now()->addMinute(),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/analysis/spread');

        $response->assertStatus(200);

        $isOutlier = $response->json('data.analysis.regular.position.is_outlier');
        $this->assertTrue($isOutlier);
    }
}
