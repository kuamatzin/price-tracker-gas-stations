<?php

namespace Tests\Feature;

use App\Models\AlertConfiguration;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiStationIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private array $stations = [];
    private Entidad $entidad;
    private Municipio $municipio;

    protected function setUp(): void
    {
        parent::setUp();

        $this->entidad = Entidad::factory()->create();
        $this->municipio = Municipio::factory()->create(['entidad_id' => $this->entidad->id]);
        
        // Create test user
        $this->user = User::factory()->create([
            'subscription_tier' => 'professional',
            'api_rate_limit' => 500,
        ]);

        // Create multiple stations
        for ($i = 0; $i < 5; $i++) {
            $this->stations[] = Station::factory()->create([
                'entidad_id' => $this->entidad->id,
                'municipio_id' => $this->municipio->id,
                'is_active' => true,
            ]);
        }
    }

    public function test_complete_station_assignment_flow()
    {
        Sanctum::actingAs($this->user);

        // 1. Search for available stations
        $response = $this->getJson('/api/v1/stations/search?q=' . substr($this->stations[0]->nombre, 0, 5));
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'numero',
                    'nombre',
                    'direccion',
                    'brand',
                    'location',
                    'is_available',
                ]
            ]
        ]);

        // 2. Assign station to user
        $response = $this->postJson('/api/v1/user/stations', [
            'station_numero' => $this->stations[0]->numero,
            'role' => 'owner',
        ]);
        $response->assertStatus(201);
        $response->assertJson([
            'message' => 'Station assigned successfully',
            'data' => [
                'numero' => $this->stations[0]->numero,
                'role' => 'owner',
            ]
        ]);

        // 3. List user's stations
        $response = $this->getJson('/api/v1/user/stations');
        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJson([
            'meta' => [
                'total' => 1,
                'has_owner_role' => true,
                'default_station_numero' => $this->stations[0]->numero,
            ]
        ]);

        // 4. Access station-specific data
        $response = $this->getJson("/api/v1/prices/station/{$this->stations[0]->numero}");
        $response->assertOk();

        // 5. Unassign station
        $response = $this->deleteJson("/api/v1/user/stations/{$this->stations[0]->numero}");
        $response->assertOk();
        $response->assertJson(['message' => 'Station unassigned successfully']);

        // 6. Verify station is removed
        $response = $this->getJson('/api/v1/user/stations');
        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_station_switching_functionality()
    {
        Sanctum::actingAs($this->user);

        // Assign multiple stations with different roles
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'manager']);
        $this->user->stations()->attach($this->stations[2]->numero, ['role' => 'viewer']);

        // Create price changes for different stations
        PriceChange::factory()->create([
            'station_numero' => $this->stations[0]->numero,
            'fuel_type' => 'regular',
            'price' => 20.50,
        ]);
        PriceChange::factory()->create([
            'station_numero' => $this->stations[1]->numero,
            'fuel_type' => 'regular',
            'price' => 21.00,
        ]);

        // Access data for station 0 (owner)
        $response = $this->getJson('/api/v1/analysis/insights?station_numero=' . $this->stations[0]->numero);
        $response->assertOk();

        // Access data for station 1 (manager)
        $response = $this->getJson('/api/v1/analysis/spread?station_numero=' . $this->stations[1]->numero);
        $response->assertOk();

        // Try to access advanced analytics for station 2 (viewer) - should fail
        $response = $this->getJson('/api/v1/analysis/insights?station_numero=' . $this->stations[2]->numero);
        $response->assertStatus(403);

        // Switch station context using header
        $response = $this->withHeaders([
            'X-Station-Numero' => $this->stations[0]->numero,
        ])->getJson('/api/v1/analysis/ranking');
        $response->assertOk();
    }

    public function test_data_filtering_by_station()
    {
        Sanctum::actingAs($this->user);

        // Assign two stations
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'owner']);

        // Create price changes for both stations
        PriceChange::factory()->count(3)->create([
            'station_numero' => $this->stations[0]->numero,
            'fuel_type' => 'regular',
        ]);
        PriceChange::factory()->count(2)->create([
            'station_numero' => $this->stations[1]->numero,
            'fuel_type' => 'premium',
        ]);

        // Create alerts for user
        $alert1 = AlertConfiguration::factory()->create([
            'user_id' => $this->user->id,
            'conditions' => [
                'stations' => [$this->stations[0]->numero],
                'threshold_percentage' => 2.0,
            ],
        ]);
        $alert2 = AlertConfiguration::factory()->create([
            'user_id' => $this->user->id,
            'conditions' => [
                'stations' => [$this->stations[1]->numero],
                'threshold_percentage' => 3.0,
            ],
        ]);

        // Query price changes for station 0
        $priceChanges = PriceChange::forStation($this->stations[0]->numero)->get();
        $this->assertCount(3, $priceChanges);
        $this->assertTrue($priceChanges->every(fn($p) => $p->station_numero === $this->stations[0]->numero));

        // Query alerts for station 0
        $alerts = AlertConfiguration::forStation($this->stations[0]->numero)->get();
        $this->assertCount(1, $alerts);
        $this->assertEquals($alert1->id, $alerts->first()->id);

        // Query all data for user's stations
        $userPriceChanges = PriceChange::forUserStations($this->user->id)->get();
        $this->assertCount(5, $userPriceChanges); // 3 + 2
    }

    public function test_unauthorized_access_scenarios()
    {
        $otherUser = User::factory()->create();
        Sanctum::actingAs($otherUser);

        // Try to access station not assigned to user
        $response = $this->getJson("/api/v1/prices/station/{$this->stations[0]->numero}");
        $response->assertStatus(403);

        // Try to unassign station not assigned to user
        $response = $this->deleteJson("/api/v1/user/stations/{$this->stations[0]->numero}");
        $response->assertStatus(404);

        // Try to access analytics without station context
        $response = $this->getJson('/api/v1/analysis/ranking');
        $response->assertStatus(422);
        $response->assertJson([
            'error' => 'station_numero is required'
        ]);

        // Try to access station with wrong role
        $otherUser->stations()->attach($this->stations[0]->numero, ['role' => 'viewer']);
        
        $response = $this->postJson('/api/v1/prices/update', [
            'station_numero' => $this->stations[0]->numero,
            'fuel_type' => 'regular',
            'price' => 20.50,
        ]);
        $response->assertStatus(403);
    }

    public function test_api_response_formats()
    {
        Sanctum::actingAs($this->user);

        // Assign stations
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'manager']);

        // Test user stations response format
        $response = $this->getJson('/api/v1/user/stations?include_stats=true');
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'numero',
                    'nombre',
                    'direccion',
                    'brand',
                    'location' => [
                        'lat',
                        'lng',
                        'municipio',
                    ],
                    'role',
                    'assigned_at',
                ]
            ],
            'meta' => [
                'total',
                'has_owner_role',
                'default_station_numero',
            ],
            'links' => [
                'self',
                'assign',
            ]
        ]);

        // Test search response format with pagination
        $response = $this->getJson('/api/v1/stations/search?per_page=10');
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [],
            'links' => [
                'first',
                'last',
                'prev',
                'next',
            ],
            'meta' => [
                'current_page',
                'from',
                'last_page',
                'per_page',
                'to',
                'total',
                'available_count',
                'filters_applied',
            ]
        ]);
    }

    public function test_performance_with_multiple_stations()
    {
        Sanctum::actingAs($this->user);

        // Assign all 5 stations
        foreach ($this->stations as $index => $station) {
            $role = $index === 0 ? 'owner' : ($index < 3 ? 'manager' : 'viewer');
            $this->user->stations()->attach($station->numero, ['role' => $role]);
        }

        // Create substantial data
        foreach ($this->stations as $station) {
            PriceChange::factory()->count(10)->create([
                'station_numero' => $station->numero,
            ]);
        }

        // Measure query performance
        $startTime = microtime(true);
        
        // Get all user stations with stats
        $response = $this->getJson('/api/v1/user/stations?include_stats=true');
        $response->assertOk();
        
        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        // Assert response time is reasonable (under 500ms)
        $this->assertLessThan(500, $executionTime, 'API response took too long');

        // Test filtering large dataset
        $startTime = microtime(true);
        
        $priceChanges = PriceChange::forUserStations($this->user->id)
            ->recent(7)
            ->get();
        
        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;
        
        $this->assertLessThan(100, $executionTime, 'Query took too long');
        $this->assertCount(50, $priceChanges); // 5 stations * 10 changes each
    }

    public function test_concurrent_station_operations()
    {
        Sanctum::actingAs($this->user);

        // Simulate concurrent assignment attempts
        $station = $this->stations[0];
        
        // First assignment should succeed
        $response1 = $this->postJson('/api/v1/user/stations', [
            'station_numero' => $station->numero,
            'role' => 'owner',
        ]);
        $response1->assertStatus(201);

        // Second assignment should fail (already assigned)
        $response2 = $this->postJson('/api/v1/user/stations', [
            'station_numero' => $station->numero,
            'role' => 'manager',
        ]);
        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['station_numero']);

        // Update should work
        $this->user->stations()->updateExistingPivot($station->numero, ['role' => 'manager']);
        
        $response = $this->getJson('/api/v1/user/stations');
        $response->assertJson([
            'data' => [
                [
                    'numero' => $station->numero,
                    'role' => 'manager',
                ]
            ]
        ]);
    }
}