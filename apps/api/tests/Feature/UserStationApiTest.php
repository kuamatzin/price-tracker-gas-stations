<?php

namespace Tests\Feature;

use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserStationApiTest extends TestCase
{
    use RefreshDatabase;
    
    protected User $user;
    
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
    }
    
    public function test_user_can_list_their_stations()
    {
        Sanctum::actingAs($this->user);
        
        $station = Station::create([
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
        
        $this->user->stations()->attach($station->numero, ['role' => 'owner']);
        
        $response = $this->getJson('/api/v1/user/stations');
        
        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.numero', 'E12345')
            ->assertJsonPath('data.0.role', 'owner');
    }
    
    public function test_user_can_assign_station()
    {
        Sanctum::actingAs($this->user);
        
        $station = Station::create([
            'numero' => 'E67890',
            'nombre' => 'New Station',
            'brand' => 'PEMEX',
            'direccion' => 'New Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.1,
            'lng' => -103.1,
            'is_active' => true,
        ]);
        
        $response = $this->postJson('/api/v1/user/stations', [
            'station_numero' => 'E67890',
            'role' => 'manager',
        ]);
        
        $response->assertStatus(201)
            ->assertJsonPath('data.numero', 'E67890')
            ->assertJsonPath('data.role', 'manager');
        
        $this->assertDatabaseHas('user_stations', [
            'user_id' => $this->user->id,
            'station_numero' => 'E67890',
            'role' => 'manager',
        ]);
    }
    
    public function test_user_cannot_assign_duplicate_station()
    {
        Sanctum::actingAs($this->user);
        
        $station = Station::create([
            'numero' => 'E11111',
            'nombre' => 'Existing Station',
            'brand' => 'PEMEX',
            'direccion' => 'Existing Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.2,
            'lng' => -103.2,
            'is_active' => true,
        ]);
        
        $this->user->stations()->attach($station->numero, ['role' => 'owner']);
        
        $response = $this->postJson('/api/v1/user/stations', [
            'station_numero' => 'E11111',
            'role' => 'manager',
        ]);
        
        $response->assertStatus(422)
            ->assertJsonPath('error.validation_errors.station_numero.0', 'This station is already assigned to you.');
    }
    
    public function test_user_can_unassign_station()
    {
        Sanctum::actingAs($this->user);
        
        $station = Station::create([
            'numero' => 'E22222',
            'nombre' => 'Station to Remove',
            'brand' => 'PEMEX',
            'direccion' => 'Remove Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.3,
            'lng' => -103.3,
            'is_active' => true,
        ]);
        
        $this->user->stations()->attach($station->numero, ['role' => 'owner']);
        
        $response = $this->deleteJson('/api/v1/user/stations/' . $station->numero);
        
        $response->assertOk()
            ->assertJson(['message' => 'Station unassigned successfully']);
        
        $this->assertDatabaseMissing('user_stations', [
            'user_id' => $this->user->id,
            'station_numero' => 'E22222',
        ]);
    }
    
    public function test_user_cannot_unassign_station_not_assigned()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->deleteJson('/api/v1/user/stations/E99999');
        
        $response->assertNotFound();
    }
    
    public function test_user_can_search_available_stations()
    {
        Sanctum::actingAs($this->user);
        
        // Create stations
        $assignedStation = Station::create([
            'numero' => 'E33333',
            'nombre' => 'Assigned Station',
            'brand' => 'PEMEX',
            'direccion' => 'Assigned Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.4,
            'lng' => -103.4,
            'is_active' => true,
        ]);
        
        $availableStation = Station::create([
            'numero' => 'E44444',
            'nombre' => 'Available Station',
            'brand' => 'SHELL',
            'direccion' => 'Available Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.5,
            'lng' => -103.5,
            'is_active' => true,
        ]);
        
        // Assign one station to user
        $this->user->stations()->attach($assignedStation->numero, ['role' => 'owner']);
        
        $response = $this->getJson('/api/v1/stations/search');
        
        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.numero', 'E44444')
            ->assertJsonMissing(['numero' => 'E33333']);
    }
    
    public function test_search_filters_by_query()
    {
        Sanctum::actingAs($this->user);
        
        Station::create([
            'numero' => 'E55555',
            'nombre' => 'PEMEX Centro',
            'brand' => 'PEMEX',
            'direccion' => 'Centro Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.6,
            'lng' => -103.6,
            'is_active' => true,
        ]);
        
        Station::create([
            'numero' => 'E66666',
            'nombre' => 'Shell Norte',
            'brand' => 'SHELL',
            'direccion' => 'Norte Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.7,
            'lng' => -103.7,
            'is_active' => true,
        ]);
        
        $response = $this->getJson('/api/v1/stations/search?q=Centro');
        
        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nombre', 'PEMEX Centro');
    }
}