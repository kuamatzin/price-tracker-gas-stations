<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Station;
use App\Models\PriceChange;
use App\Models\Entidad;
use App\Models\Municipio;

class GeoControllerTest extends TestCase
{
    use RefreshDatabase;

    private $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_estados_endpoint_returns_aggregated_data()
    {
        // Create test data
        $estado = Entidad::factory()->create(['nombre' => 'CDMX', 'codigo' => 'CDMX']);
        $municipio = Municipio::factory()->create(['entidad_id' => $estado->id]);
        
        $stations = Station::factory()->count(3)->create([
            'entidad_id' => $estado->id,
            'municipio_id' => $municipio->id,
            'is_active' => true
        ]);

        foreach ($stations as $station) {
            PriceChange::factory()->create([
                'station_numero' => $station->numero,
                'fuel_type' => 'regular',
                'price' => fake()->randomFloat(2, 22, 24),
                'changed_at' => now()
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/estados');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'estado_id',
                        'estado_nombre',
                        'estado_codigo',
                        'fuel_prices',
                        'total_stations',
                        'market_efficiency',
                        'last_update'
                    ]
                ],
                'summary' => [
                    'total_estados',
                    'national_average',
                    'cheapest_estado',
                    'most_expensive_estado'
                ]
            ]);
    }

    public function test_municipios_by_estado_endpoint_with_pagination()
    {
        $estado = Entidad::factory()->create();
        $municipios = Municipio::factory()->count(25)->create(['entidad_id' => $estado->id]);
        
        foreach ($municipios as $municipio) {
            $station = Station::factory()->create([
                'entidad_id' => $estado->id,
                'municipio_id' => $municipio->id,
                'is_active' => true
            ]);

            PriceChange::factory()->create([
                'station_numero' => $station->numero,
                'fuel_type' => 'regular',
                'price' => fake()->randomFloat(2, 22, 24),
                'changed_at' => now()
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/geo/municipios/{$estado->id}?page=1&per_page=10");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'municipio_id',
                        'municipio_nombre',
                        'fuel_prices',
                        'station_count',
                        'station_density',
                        'competitiveness_index'
                    ]
                ],
                'pagination' => [
                    'total',
                    'per_page',
                    'current_page',
                    'last_page',
                    'from',
                    'to'
                ],
                'estado'
            ])
            ->assertJsonPath('pagination.per_page', 10)
            ->assertJsonPath('pagination.current_page', 1);
    }

    public function test_municipio_stats_endpoint_returns_detailed_statistics()
    {
        $estado = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $estado->id]);
        
        $stations = Station::factory()->count(5)->create([
            'entidad_id' => $estado->id,
            'municipio_id' => $municipio->id,
            'is_active' => true
        ]);

        $prices = [22.45, 22.89, 23.01, 23.45, 23.67];
        foreach ($stations as $index => $station) {
            PriceChange::factory()->create([
                'station_numero' => $station->numero,
                'fuel_type' => 'regular',
                'price' => $prices[$index],
                'changed_at' => now()
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/geo/stats/{$municipio->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'municipio' => [
                        'id',
                        'nombre',
                        'estado'
                    ],
                    'statistics' => [
                        'regular' => [
                            'statistics' => [
                                'avg',
                                'min',
                                'max',
                                'median',
                                'stddev',
                                'coefficient_variation'
                            ],
                            'top_performers',
                            'bottom_performers',
                            'station_count',
                            'price_distribution',
                            'last_update'
                        ]
                    ],
                    'trends'
                ]
            ]);
    }

    public function test_compare_endpoint_compares_multiple_areas()
    {
        // Create two estados and one municipio for comparison
        $estado1 = Entidad::factory()->create(['nombre' => 'Estado1']);
        $estado2 = Entidad::factory()->create(['nombre' => 'Estado2']);
        $municipio = Municipio::factory()->create(['entidad_id' => $estado1->id]);

        // Add stations and prices for each area
        $this->createStationsWithPrices($estado1->id, null, 3, 22.50);
        $this->createStationsWithPrices($estado2->id, null, 3, 23.50);
        $this->createStationsWithPrices($estado1->id, $municipio->id, 3, 22.00);

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/geo/compare', [
                'areas' => [
                    ['type' => 'estado', 'id' => $estado1->id],
                    ['type' => 'estado', 'id' => $estado2->id],
                    ['type' => 'municipio', 'id' => $municipio->id]
                ],
                'fuel_types' => ['regular']
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'areas',
                    'comparison',
                    'insights',
                    'rankings' => [
                        '*' => [
                            'position',
                            'area_key',
                            'area_type',
                            'area_id',
                            'name',
                            'score',
                            'avg_prices',
                            'total_stations'
                        ]
                    ]
                ]
            ]);
    }

    public function test_heatmap_endpoint_generates_grid_data()
    {
        $estado = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $estado->id]);
        
        // Create stations within bounds
        $stations = Station::factory()->count(5)->create([
            'entidad_id' => $estado->id,
            'municipio_id' => $municipio->id,
            'lat' => fake()->latitude(19.3, 19.5),
            'lng' => fake()->longitude(-99.2, -99.0),
            'is_active' => true
        ]);

        foreach ($stations as $station) {
            PriceChange::factory()->create([
                'station_numero' => $station->numero,
                'fuel_type' => 'regular',
                'price' => fake()->randomFloat(2, 22, 24),
                'changed_at' => now()
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/heatmap?' . http_build_query([
                'north' => 19.5,
                'south' => 19.3,
                'east' => -99.0,
                'west' => -99.2,
                'zoom' => 12,
                'fuel_type' => 'regular'
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'bounds',
                    'zoom',
                    'grid_size',
                    'fuel_type',
                    'cells' => [
                        '*' => [
                            'id',
                            'bounds',
                            'center',
                            'price',
                            'intensity',
                            'color',
                            'nearby_stations'
                        ]
                    ],
                    'legend' => [
                        'fuel_type',
                        'min_price',
                        'max_price',
                        'color_scale'
                    ],
                    'statistics',
                    'timestamp'
                ]
            ]);
    }

    public function test_estados_endpoint_uses_caching()
    {
        $estado = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $estado->id]);
        $station = Station::factory()->create([
            'entidad_id' => $estado->id,
            'municipio_id' => $municipio->id,
            'is_active' => true
        ]);

        PriceChange::factory()->create([
            'station_numero' => $station->numero,
            'fuel_type' => 'regular',
            'price' => 23.00,
            'changed_at' => now()
        ]);

        // First request
        $response1 = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/estados');

        // Second request should use cache
        $response2 = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/estados');

        $response1->assertStatus(200);
        $response2->assertStatus(200);
        
        // Both responses should be identical
        $this->assertEquals(
            $response1->json(),
            $response2->json()
        );
    }

    public function test_municipio_not_found_returns_404()
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/stats/99999');

        $response->assertStatus(404)
            ->assertJson(['error' => 'Municipio not found']);
    }

    public function test_compare_endpoint_validates_input()
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/geo/compare', [
                'areas' => [
                    ['type' => 'invalid', 'id' => 1]
                ]
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['areas.0.type', 'areas']);
    }

    public function test_heatmap_validates_bounds()
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/geo/heatmap?' . http_build_query([
                'north' => 91,  // Invalid latitude
                'south' => 19.3,
                'east' => -99.0,
                'west' => -99.2,
                'zoom' => 12
            ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['north']);
    }

    public function test_authentication_required_for_all_endpoints()
    {
        $response = $this->getJson('/api/v1/geo/estados');
        $response->assertStatus(401);

        $response = $this->getJson('/api/v1/geo/municipios/1');
        $response->assertStatus(401);

        $response = $this->getJson('/api/v1/geo/stats/1');
        $response->assertStatus(401);

        $response = $this->postJson('/api/v1/geo/compare');
        $response->assertStatus(401);

        $response = $this->getJson('/api/v1/geo/heatmap');
        $response->assertStatus(401);
    }

    private function createStationsWithPrices($estadoId, $municipioId, $count, $basePrice)
    {
        if (!$municipioId) {
            $municipio = Municipio::factory()->create(['entidad_id' => $estadoId]);
            $municipioId = $municipio->id;
        }

        $stations = Station::factory()->count($count)->create([
            'entidad_id' => $estadoId,
            'municipio_id' => $municipioId,
            'is_active' => true
        ]);

        foreach ($stations as $station) {
            PriceChange::factory()->create([
                'station_numero' => $station->numero,
                'fuel_type' => 'regular',
                'price' => $basePrice + fake()->randomFloat(2, -0.5, 0.5),
                'changed_at' => now()
            ]);
        }
    }
}