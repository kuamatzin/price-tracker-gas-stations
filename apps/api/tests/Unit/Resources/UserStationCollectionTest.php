<?php

namespace Tests\Unit\Resources;

use App\Http\Resources\UserStationCollection;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class UserStationCollectionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private array $stations = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $entidad = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $entidad->id]);

        for ($i = 0; $i < 3; $i++) {
            $this->stations[] = Station::factory()->create([
                'entidad_id' => $entidad->id,
                'municipio_id' => $municipio->id,
            ]);
        }
    }

    public function test_it_includes_meta_data()
    {
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'owner']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'manager']);
        $this->user->stations()->attach($this->stations[2]->numero, ['role' => 'viewer']);

        $stations = $this->user->stations()->with(['municipio.entidad'])->get();
        $collection = new UserStationCollection($stations);
        $response = $collection->toArray(new Request());

        $this->assertArrayHasKey('meta', $response);
        $this->assertEquals(3, $response['meta']['total']);
        $this->assertTrue($response['meta']['has_owner_role']);
        $this->assertNotNull($response['meta']['default_station_numero']);
    }

    public function test_it_identifies_when_no_owner_role()
    {
        $this->user->stations()->attach($this->stations[0]->numero, ['role' => 'manager']);
        $this->user->stations()->attach($this->stations[1]->numero, ['role' => 'viewer']);

        $stations = $this->user->stations()->with(['municipio.entidad'])->get();
        $collection = new UserStationCollection($stations);
        $response = $collection->toArray(new Request());

        $this->assertFalse($response['meta']['has_owner_role']);
    }

    public function test_it_includes_links()
    {
        $stations = $this->user->stations()->with(['municipio.entidad'])->get();
        $collection = new UserStationCollection($stations);
        $fullResponse = $collection->response()->getData(true);

        $this->assertArrayHasKey('links', $fullResponse);
        $this->assertArrayHasKey('self', $fullResponse['links']);
        $this->assertArrayHasKey('assign', $fullResponse['links']);
    }

    public function test_it_handles_empty_collection()
    {
        $stations = $this->user->stations()->with(['municipio.entidad'])->get();
        $collection = new UserStationCollection($stations);
        $response = $collection->toArray(new Request());

        $this->assertEquals(0, $response['meta']['total']);
        $this->assertFalse($response['meta']['has_owner_role']);
        $this->assertNull($response['meta']['default_station_numero']);
    }
}