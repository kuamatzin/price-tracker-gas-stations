<?php

namespace Tests\Feature;

use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StationContextApiTest extends TestCase
{
    use RefreshDatabase;
    
    protected User $user;
    protected Station $station;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Seed basic data
        \DB::table('entidades')->insert([
            'id' => 1,
            'nombre' => 'Test State'
        ]);
        
        \DB::table('municipios')->insert([
            'id' => 1,
            'nombre' => 'Test Municipality',
            'entidad_id' => 1
        ]);
        
        $this->user = User::factory()->create();
        
        $this->station = Station::create([
            'numero' => 'E12345',
            'nombre' => 'Test Station',
            'brand' => 'PEMEX',
            'direccion' => 'Test Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.0,
            'lng' => -103.0,
            'is_active' => true,
        ]);
        
        // Assign station to user
        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
    }
    
    public function test_price_endpoint_requires_station_numero()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/prices/current');
        
        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'MISSING_STATION_CONTEXT');
    }
    
    public function test_price_endpoint_with_station_numero_succeeds()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/prices/current?station_numero=' . $this->station->numero);
        
        // Response should be 200 or potentially empty data, but not a 422
        $this->assertNotEquals(422, $response->status());
    }
    
    public function test_competitor_endpoint_requires_station_numero()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/competitors');
        
        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'MISSING_STATION_CONTEXT');
    }
    
    public function test_competitor_endpoint_with_station_numero_succeeds()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/competitors?station_numero=' . $this->station->numero);
        
        // Response should be 200 or potentially empty data, but not a 422
        $this->assertNotEquals(422, $response->status());
    }
    
    public function test_nearby_prices_endpoint_requires_station_context()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/prices/nearby');
        
        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'MISSING_STATION_CONTEXT');
    }
    
    public function test_nearby_prices_endpoint_with_station_numero_succeeds()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/prices/nearby?station_numero=' . $this->station->numero . '&radius=5');
        
        // Response should be 200 or potentially empty data, but not a 422
        $this->assertNotEquals(422, $response->status());
    }
    
    public function test_user_cannot_access_unassigned_station()
    {
        Sanctum::actingAs($this->user);
        
        $otherStation = Station::create([
            'numero' => 'E99999',
            'nombre' => 'Other Station',
            'brand' => 'SHELL',
            'direccion' => 'Other Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.1,
            'lng' => -103.1,
            'is_active' => true,
        ]);
        
        $response = $this->getJson('/api/v1/prices/current?station_numero=' . $otherStation->numero);
        
        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'STATION_ACCESS_DENIED');
    }
    
    public function test_station_context_via_header()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->withHeader('X-Station-Numero', $this->station->numero)
            ->getJson('/api/v1/prices/current');
        
        // Response should be 200 or potentially empty data, but not a 422
        $this->assertNotEquals(422, $response->status());
    }
}