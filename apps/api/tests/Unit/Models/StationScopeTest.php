<?php

namespace Tests\Unit\Models;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StationScopeTest extends TestCase
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
        
        $this->user = User::factory()->create();
        
        // Create multiple stations
        for ($i = 0; $i < 3; $i++) {
            $this->stations[] = Station::factory()->create([
                'entidad_id' => $this->entidad->id,
                'municipio_id' => $this->municipio->id,
            ]);
        }
        
        // Assign first two stations to user
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'manager']);
    }

    public function test_for_user_scope_returns_user_stations()
    {
        $stations = Station::forUser($this->user->id)->get();
        
        $this->assertCount(2, $stations);
        $this->assertTrue($stations->contains('numero', $this->stations[0]->numero));
        $this->assertTrue($stations->contains('numero', $this->stations[1]->numero));
        $this->assertFalse($stations->contains('numero', $this->stations[2]->numero));
    }

    public function test_for_user_with_role_scope_filters_by_role()
    {
        $ownerStations = Station::forUserWithRole($this->user->id, 'owner')->get();
        $managerStations = Station::forUserWithRole($this->user->id, 'manager')->get();
        
        $this->assertCount(1, $ownerStations);
        $this->assertEquals($this->stations[0]->numero, $ownerStations->first()->numero);
        
        $this->assertCount(1, $managerStations);
        $this->assertEquals($this->stations[1]->numero, $managerStations->first()->numero);
    }

    public function test_active_scope_returns_only_active_stations()
    {
        $this->stations[0]->update(['is_active' => false]);
        
        $activeStations = Station::active()->get();
        
        $this->assertCount(2, $activeStations);
        $this->assertFalse($activeStations->contains('numero', $this->stations[0]->numero));
    }

    public function test_within_radius_scope_filters_by_distance()
    {
        // Skip this test in SQLite since it doesn't support the required math functions
        if (config('database.default') === 'sqlite') {
            $this->markTestSkipped('SQLite does not support required math functions for distance calculation');
        }
        
        // Update station coordinates for testing
        $this->stations[0]->update(['lat' => 20.0, 'lng' => -103.0]);
        $this->stations[1]->update(['lat' => 20.01, 'lng' => -103.01]); // ~1.5km away
        $this->stations[2]->update(['lat' => 20.1, 'lng' => -103.1]);   // ~15km away
        
        $nearbyStations = Station::withinRadius(20.0, -103.0, 5)->get();
        
        $this->assertCount(2, $nearbyStations);
        $this->assertTrue($nearbyStations->contains('numero', $this->stations[0]->numero));
        $this->assertTrue($nearbyStations->contains('numero', $this->stations[1]->numero));
        $this->assertFalse($nearbyStations->contains('numero', $this->stations[2]->numero));
    }

    public function test_price_change_for_station_scope()
    {
        // Create price changes for different stations
        PriceChange::factory()->create([
            'station_numero' => $this->stations[0]->numero,
            'fuel_type' => 'regular',
        ]);
        PriceChange::factory()->create([
            'station_numero' => $this->stations[1]->numero,
            'fuel_type' => 'premium',
        ]);
        
        $priceChanges = PriceChange::forStation($this->stations[0]->numero)->get();
        
        $this->assertCount(1, $priceChanges);
        $this->assertEquals($this->stations[0]->numero, $priceChanges->first()->station_numero);
    }

    public function test_price_change_for_stations_scope()
    {
        // Create price changes
        PriceChange::factory()->count(2)->create([
            'station_numero' => $this->stations[0]->numero,
        ]);
        PriceChange::factory()->create([
            'station_numero' => $this->stations[1]->numero,
        ]);
        PriceChange::factory()->create([
            'station_numero' => $this->stations[2]->numero,
        ]);
        
        $stationNumeros = [$this->stations[0]->numero, $this->stations[1]->numero];
        $priceChanges = PriceChange::forStations($stationNumeros)->get();
        
        $this->assertCount(3, $priceChanges);
        $this->assertFalse($priceChanges->contains('station_numero', $this->stations[2]->numero));
    }

    public function test_price_change_for_user_stations_scope()
    {
        // Create price changes for all stations
        foreach ($this->stations as $station) {
            PriceChange::factory()->create([
                'station_numero' => $station->numero,
            ]);
        }
        
        $priceChanges = PriceChange::forUserStations($this->user->id)->get();
        
        $this->assertCount(2, $priceChanges);
        $this->assertTrue($priceChanges->contains('station_numero', $this->stations[0]->numero));
        $this->assertTrue($priceChanges->contains('station_numero', $this->stations[1]->numero));
        $this->assertFalse($priceChanges->contains('station_numero', $this->stations[2]->numero));
    }

    public function test_recent_scope_filters_by_date()
    {
        PriceChange::factory()->create([
            'station_numero' => $this->stations[0]->numero,
            'changed_at' => now()->subDays(2),
        ]);
        PriceChange::factory()->create([
            'station_numero' => $this->stations[0]->numero,
            'changed_at' => now()->subDays(10),
        ]);
        
        $recentChanges = PriceChange::recent(7)->get();
        
        $this->assertCount(1, $recentChanges);
        $this->assertTrue($recentChanges->first()->changed_at->isAfter(now()->subDays(7)));
    }
}