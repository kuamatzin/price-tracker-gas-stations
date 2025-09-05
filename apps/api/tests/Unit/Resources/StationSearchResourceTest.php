<?php

namespace Tests\Unit\Resources;

use App\Http\Resources\StationSearchResource;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class StationSearchResourceTest extends TestCase
{
    use RefreshDatabase;

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
    }

    public function test_it_formats_basic_station_data()
    {
        $resource = new StationSearchResource($this->station);
        $response = $resource->toArray(new Request());

        $this->assertEquals($this->station->numero, $response['numero']);
        $this->assertEquals($this->station->nombre, $response['nombre']);
        $this->assertEquals($this->station->direccion, $response['direccion']);
        $this->assertEquals($this->station->brand, $response['brand']);
        $this->assertTrue($response['is_available']);
    }

    public function test_it_includes_location_data()
    {
        $station = Station::with(['municipio.entidad'])->find($this->station->numero);
        
        $resource = new StationSearchResource($station);
        $response = $resource->toArray(new Request());

        $this->assertArrayHasKey('location', $response);
        $this->assertEquals($station->lat, $response['location']['lat']);
        $this->assertEquals($station->lng, $response['location']['lng']);
        $this->assertEquals($station->municipio->nombre, $response['location']['municipio']);
        $this->assertEquals($station->municipio->entidad->nombre, $response['location']['entidad']);
    }

    public function test_it_includes_distance_when_available()
    {
        $this->station->distance = 5.678;
        
        $resource = new StationSearchResource($this->station);
        $response = $resource->toArray(new Request());
        $data = json_decode(json_encode($response), true);

        $this->assertArrayHasKey('distance_km', $data);
        $this->assertEquals(5.68, $data['distance_km']);
    }

    public function test_it_excludes_distance_when_not_available()
    {
        $resource = new StationSearchResource($this->station);
        $response = $resource->toArray(new Request());
        $data = json_decode(json_encode($response), true);

        $this->assertArrayNotHasKey('distance_km', $data);
    }
}