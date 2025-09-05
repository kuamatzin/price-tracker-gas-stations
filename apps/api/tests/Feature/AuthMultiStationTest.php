<?php

namespace Tests\Feature;

use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthMultiStationTest extends TestCase
{
    use RefreshDatabase;
    
    protected User $user;
    protected Station $station1;
    protected Station $station2;
    
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
        
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password')
        ]);
        
        $this->station1 = Station::create([
            'numero' => 'E12345',
            'nombre' => 'Station One',
            'brand' => 'PEMEX',
            'direccion' => 'Address 1',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.0,
            'lng' => -103.0,
            'is_active' => true,
        ]);
        
        $this->station2 = Station::create([
            'numero' => 'E67890',
            'nombre' => 'Station Two',
            'brand' => 'SHELL',
            'direccion' => 'Address 2',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.1,
            'lng' => -103.1,
            'is_active' => true,
        ]);
        
        // Assign stations to user
        $this->user->stations()->attach($this->station1->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->station2->numero, ['role' => 'manager']);
    }
    
    public function test_login_returns_user_stations()
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password'
        ]);
        
        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'expires_at',
                'user' => [
                    'id',
                    'email',
                    'name',
                    'stations',
                    'default_station_numero',
                    'subscription_tier'
                ]
            ])
            ->assertJsonCount(2, 'user.stations')
            ->assertJsonPath('user.stations.0.numero', 'E12345')
            ->assertJsonPath('user.stations.0.role', 'owner')
            ->assertJsonPath('user.stations.1.numero', 'E67890')
            ->assertJsonPath('user.stations.1.role', 'manager')
            ->assertJsonPath('user.default_station_numero', 'E12345');
    }
    
    public function test_profile_endpoint_returns_user_stations()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->getJson('/api/v1/profile');
        
        $response->assertOk()
            ->assertJsonStructure([
                'user' => [
                    'id',
                    'email',
                    'name',
                    'stations',
                    'default_station_numero'
                ]
            ])
            ->assertJsonCount(2, 'user.stations');
    }
    
    public function test_register_with_station_assigns_station()
    {
        $newStation = Station::create([
            'numero' => 'E99999',
            'nombre' => 'New Station',
            'brand' => 'BP',
            'direccion' => 'New Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.2,
            'lng' => -103.2,
            'is_active' => true,
        ]);
        
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'station_numero' => 'E99999'
        ]);
        
        $response->assertStatus(201)
            ->assertJsonCount(1, 'user.stations')
            ->assertJsonPath('user.stations.0.numero', 'E99999')
            ->assertJsonPath('user.stations.0.role', 'owner');
    }
    
    public function test_refresh_token_returns_user_stations()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->postJson('/api/v1/auth/refresh');
        
        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'expires_at',
                'user' => [
                    'id',
                    'email',
                    'name',
                    'stations',
                    'default_station_numero'
                ]
            ])
            ->assertJsonCount(2, 'user.stations');
    }
    
    public function test_profile_update_can_set_default_station()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->putJson('/api/v1/profile', [
            'default_station_numero' => 'E67890'
        ]);
        
        $response->assertOk()
            ->assertJsonPath('user.default_station_numero', 'E67890');
    }
    
    public function test_profile_update_rejects_unassigned_station_as_default()
    {
        Sanctum::actingAs($this->user);
        
        $response = $this->putJson('/api/v1/profile', [
            'default_station_numero' => 'E00000'
        ]);
        
        $response->assertStatus(403)
            ->assertJson(['error' => 'You do not have access to this station']);
    }
    
    public function test_user_with_no_stations_returns_empty_array()
    {
        $userNoStations = User::factory()->create([
            'email' => 'nostations@example.com',
            'password' => bcrypt('password')
        ]);
        
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'nostations@example.com',
            'password' => 'password'
        ]);
        
        $response->assertOk()
            ->assertJsonCount(0, 'user.stations')
            ->assertJsonPath('user.default_station_numero', null);
    }
}