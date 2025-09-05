<?php

namespace Tests\Unit\Policies;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use App\Policies\StationPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StationPolicyTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $manager;
    private User $viewer;
    private User $otherUser;
    private Station $station;
    private StationPolicy $policy;

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
        $this->otherUser = User::factory()->create();

        // Assign roles
        $this->owner->stations()->attach($this->station->numero, ['role' => 'owner']);
        $this->manager->stations()->attach($this->station->numero, ['role' => 'manager']);
        $this->viewer->stations()->attach($this->station->numero, ['role' => 'viewer']);

        $this->policy = new StationPolicy();
    }

    public function test_view_permission()
    {
        $this->assertTrue($this->policy->view($this->owner, $this->station));
        $this->assertTrue($this->policy->view($this->manager, $this->station));
        $this->assertTrue($this->policy->view($this->viewer, $this->station));
        $this->assertFalse($this->policy->view($this->otherUser, $this->station));
    }

    public function test_manage_prices_permission()
    {
        $this->assertTrue($this->policy->managePrices($this->owner, $this->station));
        $this->assertFalse($this->policy->managePrices($this->manager, $this->station));
        $this->assertFalse($this->policy->managePrices($this->viewer, $this->station));
        $this->assertFalse($this->policy->managePrices($this->otherUser, $this->station));
    }

    public function test_view_analytics_permission()
    {
        $this->assertTrue($this->policy->viewAnalytics($this->owner, $this->station));
        $this->assertTrue($this->policy->viewAnalytics($this->manager, $this->station));
        $this->assertFalse($this->policy->viewAnalytics($this->viewer, $this->station));
        $this->assertFalse($this->policy->viewAnalytics($this->otherUser, $this->station));
    }

    public function test_view_advanced_analytics_permission()
    {
        $this->assertTrue($this->policy->viewAdvancedAnalytics($this->owner, $this->station));
        $this->assertFalse($this->policy->viewAdvancedAnalytics($this->manager, $this->station));
        $this->assertFalse($this->policy->viewAdvancedAnalytics($this->viewer, $this->station));
        $this->assertFalse($this->policy->viewAdvancedAnalytics($this->otherUser, $this->station));
    }

    public function test_manage_alerts_permission()
    {
        $this->assertTrue($this->policy->manageAlerts($this->owner, $this->station));
        $this->assertFalse($this->policy->manageAlerts($this->manager, $this->station));
        $this->assertFalse($this->policy->manageAlerts($this->viewer, $this->station));
        $this->assertFalse($this->policy->manageAlerts($this->otherUser, $this->station));
    }

    public function test_view_alerts_permission()
    {
        $this->assertTrue($this->policy->viewAlerts($this->owner, $this->station));
        $this->assertTrue($this->policy->viewAlerts($this->manager, $this->station));
        $this->assertFalse($this->policy->viewAlerts($this->viewer, $this->station));
        $this->assertFalse($this->policy->viewAlerts($this->otherUser, $this->station));
    }

    public function test_update_settings_permission()
    {
        $this->assertTrue($this->policy->updateSettings($this->owner, $this->station));
        $this->assertFalse($this->policy->updateSettings($this->manager, $this->station));
        $this->assertFalse($this->policy->updateSettings($this->viewer, $this->station));
        $this->assertFalse($this->policy->updateSettings($this->otherUser, $this->station));
    }

    public function test_assign_users_permission()
    {
        $this->assertTrue($this->policy->assignUsers($this->owner, $this->station));
        $this->assertFalse($this->policy->assignUsers($this->manager, $this->station));
        $this->assertFalse($this->policy->assignUsers($this->viewer, $this->station));
        $this->assertFalse($this->policy->assignUsers($this->otherUser, $this->station));
    }

    public function test_has_role_method()
    {
        $this->assertTrue($this->policy->hasRole($this->owner, $this->station, 'owner'));
        $this->assertFalse($this->policy->hasRole($this->owner, $this->station, 'manager'));
        
        $this->assertTrue($this->policy->hasRole($this->manager, $this->station, 'manager'));
        $this->assertFalse($this->policy->hasRole($this->manager, $this->station, 'owner'));
        
        $this->assertTrue($this->policy->hasRole($this->viewer, $this->station, 'viewer'));
        $this->assertFalse($this->policy->hasRole($this->viewer, $this->station, 'owner'));
    }

    public function test_has_any_role_method()
    {
        $this->assertTrue($this->policy->hasAnyRole($this->owner, $this->station, ['owner', 'manager']));
        $this->assertTrue($this->policy->hasAnyRole($this->manager, $this->station, ['owner', 'manager']));
        $this->assertFalse($this->policy->hasAnyRole($this->viewer, $this->station, ['owner', 'manager']));
        $this->assertTrue($this->policy->hasAnyRole($this->viewer, $this->station, ['viewer', 'manager']));
    }
}