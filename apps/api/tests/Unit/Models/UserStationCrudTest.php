<?php

namespace Tests\Unit\Models;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserStationCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $entidad = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $entidad->id]);
        
        $this->station = Station::factory()->create([
            'entidad_id' => $entidad->id,
            'municipio_id' => $municipio->id,
        ]);
        
        $this->user = User::factory()->create();
    }

    public function test_can_create_user_station_assignment()
    {
        $this->user->stations()->attach($this->station->numero, [
            'role' => 'owner'
        ]);

        $this->assertDatabaseHas('user_stations', [
            'user_id' => $this->user->id,
            'station_numero' => $this->station->numero,
            'role' => 'owner',
        ]);

        $this->assertTrue($this->user->stations->contains('numero', $this->station->numero));
    }

    public function test_can_update_user_station_role()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'viewer']);
        
        $this->user->stations()->updateExistingPivot($this->station->numero, [
            'role' => 'manager'
        ]);

        $this->assertDatabaseHas('user_stations', [
            'user_id' => $this->user->id,
            'station_numero' => $this->station->numero,
            'role' => 'manager',
        ]);
    }

    public function test_can_delete_user_station_assignment()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        
        $this->user->stations()->detach($this->station->numero);

        $this->assertDatabaseMissing('user_stations', [
            'user_id' => $this->user->id,
            'station_numero' => $this->station->numero,
        ]);
    }

    public function test_prevents_duplicate_user_station_assignments()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        
        // Using syncWithoutDetaching to prevent duplicates
        $this->user->stations()->syncWithoutDetaching([
            $this->station->numero => ['role' => 'manager']
        ]);

        $count = $this->user->stations()
            ->where('station_numero', $this->station->numero)
            ->count();

        $this->assertEquals(1, $count);
        
        // Role should be updated to the latest
        $this->assertEquals('manager', 
            $this->user->stations()->first()->pivot->role
        );
    }

    public function test_can_assign_multiple_stations_to_user()
    {
        $entidad = Entidad::first();
        $municipio = Municipio::first();
        
        $stations = Station::factory()->count(3)->create([
            'entidad_id' => $entidad->id,
            'municipio_id' => $municipio->id,
        ]);

        foreach ($stations as $index => $station) {
            $roles = ['owner', 'manager', 'viewer'];
            $this->user->stations()->attach($station->numero, [
                'role' => $roles[$index]
            ]);
        }

        $this->assertEquals(3, $this->user->stations()->count());
        
        // Check each role
        $this->assertEquals('owner', 
            $this->user->stations()->where('station_numero', $stations[0]->numero)->first()->pivot->role
        );
        $this->assertEquals('manager', 
            $this->user->stations()->where('station_numero', $stations[1]->numero)->first()->pivot->role
        );
        $this->assertEquals('viewer', 
            $this->user->stations()->where('station_numero', $stations[2]->numero)->first()->pivot->role
        );
    }

    public function test_can_get_stations_by_role()
    {
        $entidad = Entidad::first();
        $municipio = Municipio::first();
        
        $ownerStation = Station::factory()->create([
            'entidad_id' => $entidad->id,
            'municipio_id' => $municipio->id,
        ]);
        $managerStation = Station::factory()->create([
            'entidad_id' => $entidad->id,
            'municipio_id' => $municipio->id,
        ]);

        $this->user->stations()->attach($ownerStation->numero, ['role' => 'owner']);
        $this->user->stations()->attach($managerStation->numero, ['role' => 'manager']);

        $ownerStations = $this->user->stations()
            ->wherePivot('role', 'owner')
            ->get();

        $managerStations = $this->user->stations()
            ->wherePivot('role', 'manager')
            ->get();

        $this->assertEquals(1, $ownerStations->count());
        $this->assertEquals($ownerStation->numero, $ownerStations->first()->numero);

        $this->assertEquals(1, $managerStations->count());
        $this->assertEquals($managerStation->numero, $managerStations->first()->numero);
    }

    public function test_cascade_deletes_on_user_deletion()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        
        $userId = $this->user->id;
        $this->user->delete();

        $this->assertDatabaseMissing('user_stations', [
            'user_id' => $userId,
        ]);
    }

    public function test_station_users_relationship()
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $user1->stations()->attach($this->station->numero, ['role' => 'owner']);
        $user2->stations()->attach($this->station->numero, ['role' => 'viewer']);

        $stationUsers = $this->station->users;

        $this->assertEquals(2, $stationUsers->count());
        $this->assertTrue($stationUsers->contains('id', $user1->id));
        $this->assertTrue($stationUsers->contains('id', $user2->id));
    }
}