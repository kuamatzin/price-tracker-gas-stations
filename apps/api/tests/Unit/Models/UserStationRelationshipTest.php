<?php

namespace Tests\Unit\Models;

use App\Models\Station;
use App\Models\User;
use App\Models\UserStation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserStationRelationshipTest extends TestCase
{
    use RefreshDatabase;
    
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
    }

    public function test_user_can_have_multiple_stations()
    {
        $user = User::factory()->create();
        
        // Create stations
        $station1 = Station::create([
            'numero' => 'E12345',
            'nombre' => 'Test Station 1',
            'brand' => 'PEMEX',
            'direccion' => 'Test Address 1',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.0,
            'lng' => -103.0,
            'is_active' => true,
        ]);
        
        $station2 = Station::create([
            'numero' => 'E67890',
            'nombre' => 'Test Station 2',
            'brand' => 'PEMEX',
            'direccion' => 'Test Address 2',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.1,
            'lng' => -103.1,
            'is_active' => true,
        ]);
        
        // Attach stations to user with different roles
        $user->stations()->attach($station1->numero, ['role' => 'owner']);
        $user->stations()->attach($station2->numero, ['role' => 'manager']);
        
        // Assert user has 2 stations
        $this->assertCount(2, $user->stations);
        
        // Assert roles are correctly saved
        $this->assertEquals('owner', $user->stations->where('numero', 'E12345')->first()->pivot->role);
        $this->assertEquals('manager', $user->stations->where('numero', 'E67890')->first()->pivot->role);
    }
    
    public function test_station_can_have_multiple_users()
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        
        $station = Station::create([
            'numero' => 'E11111',
            'nombre' => 'Shared Station',
            'brand' => 'PEMEX',
            'direccion' => 'Shared Address',
            'entidad_id' => 1,
            'municipio_id' => 1,
            'lat' => 20.0,
            'lng' => -103.0,
            'is_active' => true,
        ]);
        
        // Attach same station to multiple users
        $station->users()->attach($user1->id, ['role' => 'owner']);
        $station->users()->attach($user2->id, ['role' => 'viewer']);
        
        // Assert station has 2 users
        $this->assertCount(2, $station->users);
        
        // Assert different roles for each user
        $this->assertEquals('owner', $station->users->where('id', $user1->id)->first()->pivot->role);
        $this->assertEquals('viewer', $station->users->where('id', $user2->id)->first()->pivot->role);
    }
}