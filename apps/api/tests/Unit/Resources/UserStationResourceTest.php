<?php

namespace Tests\Unit\Resources;

use App\Http\Resources\UserStationResource;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class UserStationResourceTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;
    private User $user;

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

    public function test_it_formats_station_with_pivot_data()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        $station = $this->user->stations()->first();
        
        $resource = new UserStationResource($station);
        $response = $resource->toArray(new Request());

        $this->assertEquals($this->station->numero, $response['numero']);
        $this->assertEquals($this->station->nombre, $response['nombre']);
        $this->assertEquals('owner', $response['user_role']);
        $this->assertArrayHasKey('assigned_at', $response);
    }

    public function test_it_includes_location_data_when_loaded()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'manager']);
        $station = $this->user->stations()->with(['municipio.entidad'])->first();
        
        $resource = new UserStationResource($station);
        $response = $resource->toArray(new Request());

        $this->assertArrayHasKey('location', $response);
        $this->assertArrayHasKey('municipio', $response['location']);
        $this->assertEquals($station->municipio->nombre, $response['location']['municipio']['nombre']);
        $this->assertEquals($station->municipio->entidad->nombre, $response['location']['municipio']['entidad']['nombre']);
    }

    public function test_it_includes_statistics_when_requested()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'viewer']);
        $station = $this->user->stations()
            ->withCount('priceChanges')
            ->first();
        
        $request = new Request(['include_stats' => true]);
        $resource = new UserStationResource($station);
        $response = $resource->toArray($request);

        $this->assertArrayHasKey('stats', $response);
        $this->assertArrayHasKey('total_price_changes', $response['stats']);
    }

    public function test_it_excludes_statistics_when_not_requested()
    {
        $this->user->stations()->attach($this->station->numero, ['role' => 'viewer']);
        $station = $this->user->stations()->first();
        
        $resource = new UserStationResource($station);
        $response = $resource->toArray(new Request());
        $data = json_decode(json_encode($response), true);

        $this->assertArrayNotHasKey('stats', $data);
    }
}