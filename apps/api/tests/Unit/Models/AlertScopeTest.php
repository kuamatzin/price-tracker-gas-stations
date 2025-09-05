<?php

namespace Tests\Unit\Models;

use App\Models\AlertConfiguration;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertScopeTest extends TestCase
{
    use RefreshDatabase;

    private User $user1;
    private User $user2;
    private array $stations = [];

    protected function setUp(): void
    {
        parent::setUp();

        $entidad = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $entidad->id]);
        
        $this->user1 = User::factory()->create();
        $this->user2 = User::factory()->create();
        
        // Create stations
        for ($i = 0; $i < 3; $i++) {
            $this->stations[] = Station::factory()->create([
                'entidad_id' => $entidad->id,
                'municipio_id' => $municipio->id,
            ]);
        }
        
        // Assign stations to users
        $this->user1->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user1->stations()->attach($this->stations[1]->numero, ['role' => 'manager']);
        $this->user2->stations()->attach($this->stations[2]->numero, ['role' => 'owner']);
    }

    public function test_for_station_scope_includes_alerts_for_specific_station()
    {
        // Create alert with specific station
        $alert1 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[0]->numero],
                'threshold_percentage' => 2.0,
            ],
        ]);
        
        // Create alert with multiple stations
        $alert2 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[0]->numero, $this->stations[1]->numero],
                'threshold_percentage' => 3.0,
            ],
        ]);
        
        // Create alert with different station
        $alert3 = AlertConfiguration::factory()->create([
            'user_id' => $this->user2->id,
            'conditions' => [
                'stations' => [$this->stations[2]->numero],
                'threshold_percentage' => 2.0,
            ],
        ]);
        
        $alerts = AlertConfiguration::forStation($this->stations[0]->numero)->get();
        
        $this->assertCount(2, $alerts);
        $this->assertTrue($alerts->contains('id', $alert1->id));
        $this->assertTrue($alerts->contains('id', $alert2->id));
        $this->assertFalse($alerts->contains('id', $alert3->id));
    }

    public function test_for_station_scope_includes_alerts_without_station_filter()
    {
        // Alert with no station filter (applies to all)
        $alert1 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'threshold_percentage' => 2.0,
            ],
        ]);
        
        // Alert with empty stations array
        $alert2 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [],
                'threshold_percentage' => 3.0,
            ],
        ]);
        
        // Alert with specific station
        $alert3 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[1]->numero],
                'threshold_percentage' => 2.0,
            ],
        ]);
        
        $alerts = AlertConfiguration::forStation($this->stations[0]->numero)->get();
        
        $this->assertCount(2, $alerts);
        $this->assertTrue($alerts->contains('id', $alert1->id));
        $this->assertTrue($alerts->contains('id', $alert2->id));
        $this->assertFalse($alerts->contains('id', $alert3->id));
    }

    public function test_for_stations_scope_filters_by_multiple_stations()
    {
        $alert1 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[0]->numero],
            ],
        ]);
        
        $alert2 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[1]->numero],
            ],
        ]);
        
        $alert3 = AlertConfiguration::factory()->create([
            'user_id' => $this->user2->id,
            'conditions' => [
                'stations' => [$this->stations[2]->numero],
            ],
        ]);
        
        $stationNumeros = [$this->stations[0]->numero, $this->stations[1]->numero];
        $alerts = AlertConfiguration::forStations($stationNumeros)->get();
        
        $this->assertCount(2, $alerts);
        $this->assertTrue($alerts->contains('id', $alert1->id));
        $this->assertTrue($alerts->contains('id', $alert2->id));
        $this->assertFalse($alerts->contains('id', $alert3->id));
    }

    public function test_for_user_stations_scope_filters_by_user_access()
    {
        // Create alerts for different users and stations
        $alert1 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[0]->numero],
            ],
        ]);
        
        $alert2 = AlertConfiguration::factory()->create([
            'user_id' => $this->user1->id,
            'conditions' => [
                'stations' => [$this->stations[2]->numero], // User1 doesn't have access to this
            ],
        ]);
        
        $alert3 = AlertConfiguration::factory()->create([
            'user_id' => $this->user2->id,
            'conditions' => [
                'stations' => [$this->stations[2]->numero],
            ],
        ]);
        
        $alerts = AlertConfiguration::forUserStations($this->user1->id)->get();
        
        $this->assertCount(1, $alerts);
        $this->assertTrue($alerts->contains('id', $alert1->id));
        $this->assertFalse($alerts->contains('id', $alert2->id));
        $this->assertFalse($alerts->contains('id', $alert3->id));
    }
}