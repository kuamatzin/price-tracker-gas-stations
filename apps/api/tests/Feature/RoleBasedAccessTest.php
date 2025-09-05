<?php

namespace Tests\Feature;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleBasedAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $manager;
    private User $viewer;
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

        $this->owner = User::factory()->create();
        $this->manager = User::factory()->create();
        $this->viewer = User::factory()->create();

        // Assign roles
        $this->owner->stations()->attach($this->station->numero, ['role' => 'owner']);
        $this->manager->stations()->attach($this->station->numero, ['role' => 'manager']);
        $this->viewer->stations()->attach($this->station->numero, ['role' => 'viewer']);
    }

    public function test_owner_can_access_all_endpoints()
    {
        Sanctum::actingAs($this->owner);

        // Can view prices
        $response = $this->getJson("/api/v1/prices/station/{$this->station->numero}");
        $response->assertStatus(200);

        // Can access basic analytics
        $response = $this->getJson('/api/v1/analysis/ranking?station_numero=' . $this->station->numero);
        $response->assertOk();

        // Can access advanced analytics
        $response = $this->getJson('/api/v1/analysis/spread?station_numero=' . $this->station->numero);
        $response->assertOk();

        $response = $this->getJson('/api/v1/analysis/insights?station_numero=' . $this->station->numero);
        $response->assertOk();
    }

    public function test_manager_can_access_analytics_but_not_manage_prices()
    {
        Sanctum::actingAs($this->manager);

        // Can view prices
        $response = $this->getJson("/api/v1/prices/station/{$this->station->numero}");
        $response->assertStatus(200);

        // Can access basic analytics
        $response = $this->getJson('/api/v1/analysis/ranking?station_numero=' . $this->station->numero);
        $response->assertOk();

        // Can access advanced analytics
        $response = $this->getJson('/api/v1/analysis/spread?station_numero=' . $this->station->numero);
        $response->assertOk();

        // Cannot manage prices
        $response = $this->postJson('/api/v1/prices/update', [
            'station_numero' => $this->station->numero,
            'fuel_type' => 'regular',
            'price' => 20.50,
        ]);
        $response->assertStatus(403);
    }

    public function test_viewer_can_only_view_prices_and_basic_analytics()
    {
        Sanctum::actingAs($this->viewer);

        // Can view prices
        $response = $this->getJson("/api/v1/prices/station/{$this->station->numero}");
        $response->assertStatus(200);

        // Can access basic analytics
        $response = $this->getJson('/api/v1/analysis/ranking?station_numero=' . $this->station->numero);
        $response->assertOk();

        // Cannot access advanced analytics
        $response = $this->getJson('/api/v1/analysis/spread?station_numero=' . $this->station->numero);
        $response->assertStatus(403);

        $response = $this->getJson('/api/v1/analysis/insights?station_numero=' . $this->station->numero);
        $response->assertStatus(403);

        // Cannot manage prices
        $response = $this->postJson('/api/v1/prices/update', [
            'station_numero' => $this->station->numero,
            'fuel_type' => 'regular',
            'price' => 20.50,
        ]);
        $response->assertStatus(403);
    }

    public function test_check_station_role_middleware_blocks_unauthorized_roles()
    {
        Sanctum::actingAs($this->viewer);

        // Try to access owner-only endpoint
        $response = $this->postJson('/api/v1/prices/update', [
            'station_numero' => $this->station->numero,
            'fuel_type' => 'regular',
            'price' => 20.50,
        ]);

        $response->assertStatus(403);
        $response->assertJson([
            'error' => [
                'code' => 'INSUFFICIENT_ROLE',
                'title' => 'Insufficient Permissions',
            ]
        ]);
    }

    public function test_user_without_station_access_cannot_view_station_data()
    {
        $otherUser = User::factory()->create();
        Sanctum::actingAs($otherUser);

        // Cannot view prices
        $response = $this->getJson("/api/v1/prices/station/{$this->station->numero}");
        $response->assertStatus(403);

        // Cannot access analytics
        $response = $this->getJson('/api/v1/analysis/ranking?station_numero=' . $this->station->numero);
        $response->assertStatus(403);
    }

    public function test_gates_work_correctly()
    {
        $this->actingAs($this->owner);
        
        // Owner gate
        $this->assertTrue(\Gate::allows('station-owner', $this->station->numero));
        $this->assertTrue(\Gate::allows('station-manager', $this->station->numero));
        $this->assertTrue(\Gate::allows('station-viewer', $this->station->numero));

        $this->actingAs($this->manager);
        
        // Manager gate
        $this->assertFalse(\Gate::allows('station-owner', $this->station->numero));
        $this->assertTrue(\Gate::allows('station-manager', $this->station->numero));
        $this->assertTrue(\Gate::allows('station-viewer', $this->station->numero));

        $this->actingAs($this->viewer);
        
        // Viewer gate
        $this->assertFalse(\Gate::allows('station-owner', $this->station->numero));
        $this->assertFalse(\Gate::allows('station-manager', $this->station->numero));
        $this->assertTrue(\Gate::allows('station-viewer', $this->station->numero));
    }
}