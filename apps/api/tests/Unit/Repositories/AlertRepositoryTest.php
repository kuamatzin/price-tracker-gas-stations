<?php

namespace Tests\Unit\Repositories;

use App\Models\AlertConfiguration;
use App\Repositories\AlertRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private AlertRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new AlertRepository;
    }

    public function test_evaluate_price_change_alert_any_condition()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'fuel_types' => ['regular', 'premium'],
                'threshold_percentage' => 2.0,
                'comparison_type' => 'any',
            ],
        ]);

        $priceChanges = [
            ['fuel_type' => 'regular', 'change_percentage' => 2.5],
            ['fuel_type' => 'premium', 'change_percentage' => 1.5],
            ['fuel_type' => 'diesel', 'change_percentage' => 3.0],
        ];

        $result = $this->repository->evaluatePriceChangeAlert($alert, $priceChanges);

        $this->assertTrue($result); // Regular exceeds threshold
    }

    public function test_evaluate_price_change_alert_all_condition()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'fuel_types' => ['regular', 'premium'],
                'threshold_percentage' => 2.0,
                'comparison_type' => 'all',
            ],
        ]);

        $priceChanges = [
            ['fuel_type' => 'regular', 'change_percentage' => 2.5],
            ['fuel_type' => 'premium', 'change_percentage' => 1.5], // Below threshold
        ];

        $result = $this->repository->evaluatePriceChangeAlert($alert, $priceChanges);

        $this->assertFalse($result); // Not all fuel types meet threshold
    }

    public function test_evaluate_price_change_alert_all_condition_met()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'fuel_types' => ['regular', 'premium'],
                'threshold_percentage' => 2.0,
                'comparison_type' => 'all',
            ],
        ]);

        $priceChanges = [
            ['fuel_type' => 'regular', 'change_percentage' => 2.5],
            ['fuel_type' => 'premium', 'change_percentage' => 3.0],
        ];

        $result = $this->repository->evaluatePriceChangeAlert($alert, $priceChanges);

        $this->assertTrue($result); // All fuel types meet threshold
    }

    public function test_evaluate_competitor_move_alert()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'threshold_percentage' => 2.0,
                'competitor_stations' => ['COMP1', 'COMP2'],
            ],
        ]);

        $competitorChanges = [
            ['station_numero' => 'COMP1', 'change_percentage' => 2.5],
            ['station_numero' => 'COMP3', 'change_percentage' => 3.0],
        ];

        $result = $this->repository->evaluateCompetitorMoveAlert($alert, $competitorChanges);

        $this->assertTrue($result); // COMP1 meets threshold
    }

    public function test_evaluate_competitor_move_alert_no_specific_stations()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'threshold_percentage' => 2.0,
                'competitor_stations' => [],
            ],
        ]);

        $competitorChanges = [
            ['station_numero' => 'ANY1', 'change_percentage' => 1.5],
            ['station_numero' => 'ANY2', 'change_percentage' => 2.5],
        ];

        $result = $this->repository->evaluateCompetitorMoveAlert($alert, $competitorChanges);

        $this->assertTrue($result); // ANY2 meets threshold
    }

    public function test_evaluate_market_trend_alert_by_change()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'threshold_percentage' => 2.0,
                'fuel_types' => ['regular'],
            ],
        ]);

        $marketData = [
            'regular' => [
                'change_percentage' => 2.5,
                'std_deviation' => 1.0,
            ],
        ];

        $result = $this->repository->evaluateMarketTrendAlert($alert, $marketData);

        $this->assertTrue($result); // Change exceeds threshold
    }

    public function test_evaluate_market_trend_alert_by_volatility()
    {
        $alert = new AlertConfiguration([
            'conditions' => [
                'threshold_percentage' => 2.0,
                'fuel_types' => ['regular'],
            ],
        ]);

        $marketData = [
            'regular' => [
                'change_percentage' => 1.0,
                'std_deviation' => 3.0, // High volatility
            ],
        ];

        $result = $this->repository->evaluateMarketTrendAlert($alert, $marketData);

        $this->assertTrue($result); // Volatility exceeds threshold
    }

    public function test_get_alerts_to_process_respects_cooldown()
    {
        $user = \App\Models\User::factory()->create();

        // Alert just triggered
        $recentAlert = AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Recent Alert',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true,
            'last_triggered_at' => now()->subMinutes(30), // Within cooldown
        ]);

        // Alert ready to trigger
        $readyAlert = AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Ready Alert',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true,
            'last_triggered_at' => now()->subMinutes(90), // Outside cooldown
        ]);

        // Never triggered alert
        $newAlert = AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'New Alert',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true,
            'last_triggered_at' => null,
        ]);

        $alerts = $this->repository->getAlertsToProcess(60);

        $this->assertCount(2, $alerts); // Ready and New alerts
        $this->assertTrue($alerts->contains('id', $readyAlert->id));
        $this->assertTrue($alerts->contains('id', $newAlert->id));
        $this->assertFalse($alerts->contains('id', $recentAlert->id));
    }

    public function test_mark_as_triggered()
    {
        $user = \App\Models\User::factory()->create();

        $alert = AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Test Alert',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true,
            'last_triggered_at' => null,
        ]);

        $this->assertNull($alert->last_triggered_at);

        $result = $this->repository->markAsTriggered($alert->id);

        $this->assertTrue($result);

        $alert->refresh();
        $this->assertNotNull($alert->last_triggered_at);
        $this->assertTrue($alert->last_triggered_at->isToday());
    }

    public function test_get_user_alert_stats()
    {
        $user = \App\Models\User::factory()->create();

        // Create various alerts
        AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Active Alert 1',
            'type' => 'price_change',
            'conditions' => [],
            'is_active' => true,
            'last_triggered_at' => now()->subHours(2),
        ]);

        AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Active Alert 2',
            'type' => 'competitor_move',
            'conditions' => [],
            'is_active' => true,
            'last_triggered_at' => null,
        ]);

        AlertConfiguration::create([
            'user_id' => $user->id,
            'name' => 'Inactive Alert',
            'type' => 'market_trend',
            'conditions' => [],
            'is_active' => false,
            'last_triggered_at' => null,
        ]);

        $stats = $this->repository->getUserAlertStats($user->id);

        $this->assertEquals(3, $stats['total']);
        $this->assertEquals(2, $stats['active']);
        $this->assertEquals(1, $stats['inactive']);
        $this->assertEquals(1, $stats['triggered_today']);
        $this->assertEquals(1, $stats['types']['price_change']);
        $this->assertEquals(1, $stats['types']['competitor_move']);
        $this->assertEquals(1, $stats['types']['market_trend']);
    }
}
