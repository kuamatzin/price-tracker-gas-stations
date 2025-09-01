<?php

namespace Tests\Integration\Analytics;

use App\Jobs\ProcessAlertsJob;
use App\Models\AlertConfiguration;
use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use App\Repositories\AlertRepository;
use App\Repositories\AnalyticsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Telegram\Bot\Laravel\Facades\Telegram;
use Tests\TestCase;

class AlertSystemTest extends TestCase
{
    use RefreshDatabase;

    private AlertRepository $alertRepository;

    private AnalyticsRepository $analyticsRepository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->alertRepository = new AlertRepository;
        $this->analyticsRepository = new AnalyticsRepository;
        $this->seedTestData();
    }

    private function seedTestData(): void
    {
        // Create test user with telegram ID
        $this->user = User::factory()->create([
            'telegram_chat_id' => '123456789',
        ]);

        // Create test station
        $this->station = Station::create([
            'numero' => 'TEST001',
            'nombre' => 'Test Station',
            'brand' => 'Test Brand',
            'lat' => 19.4326,
            'lng' => -99.1332,
            'municipio_id' => 1,
            'is_active' => true,
        ]);

        // Associate station with user
        $this->user->stations()->attach($this->station);
    }

    public function test_alert_condition_evaluation_price_change()
    {
        $alert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Price Change Alert',
            'type' => 'price_change',
            'conditions' => [
                'fuel_types' => ['regular'],
                'threshold_percentage' => 2.0,
                'comparison_type' => 'any',
            ],
            'is_active' => true,
        ]);

        // Create price changes
        PriceChange::create([
            'station_numero' => 'TEST001',
            'fuel_type' => 'regular',
            'price' => 20.0,
            'changed_at' => now()->subHours(2),
            'detected_at' => now()->subHours(2),
        ]);

        PriceChange::create([
            'station_numero' => 'TEST001',
            'fuel_type' => 'regular',
            'price' => 20.5, // 2.5% increase
            'changed_at' => now()->subMinutes(30),
            'detected_at' => now()->subMinutes(30),
        ]);

        $priceChanges = $this->analyticsRepository->getRecentPriceChanges(['TEST001'], 1);

        $result = $this->alertRepository->evaluatePriceChangeAlert(
            $alert,
            $priceChanges->toArray()
        );

        $this->assertTrue($result);
    }

    public function test_alert_cooldown_mechanism()
    {
        $alert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Cooldown Test Alert',
            'type' => 'price_change',
            'conditions' => [
                'fuel_types' => ['regular'],
                'threshold_percentage' => 1.0,
            ],
            'is_active' => true,
            'last_triggered_at' => now()->subMinutes(30), // Within 60-minute cooldown
        ]);

        $this->assertTrue($alert->isInCooldown(60));
        $this->assertFalse($alert->isInCooldown(30));

        // Alert should not be in the list of alerts to process
        $alertsToProcess = $this->alertRepository->getAlertsToProcess(60);
        $this->assertFalse($alertsToProcess->contains('id', $alert->id));

        // Update last_triggered_at to be outside cooldown
        $alert->update(['last_triggered_at' => now()->subMinutes(90)]);

        $alertsToProcess = $this->alertRepository->getAlertsToProcess(60);
        $this->assertTrue($alertsToProcess->contains('id', $alert->id));
    }

    public function test_notification_delivery_mock()
    {
        Queue::fake();
        Telegram::shouldReceive('sendMessage')->once();

        $alert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Notification Test',
            'type' => 'price_change',
            'conditions' => [
                'fuel_types' => ['regular'],
                'threshold_percentage' => 1.0,
            ],
            'is_active' => true,
        ]);

        // Dispatch the job
        ProcessAlertsJob::dispatch($this->user->id, $alert->id);

        Queue::assertPushed(ProcessAlertsJob::class, function ($job) {
            return $job->queue === 'high'; // Should be on high priority queue
        });
    }

    public function test_multiple_alert_types_for_same_user()
    {
        // Create multiple alert types
        $priceAlert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Price Alert',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true,
        ]);

        $competitorAlert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Competitor Alert',
            'type' => 'competitor_move',
            'conditions' => ['threshold_percentage' => 1.5],
            'is_active' => true,
        ]);

        $trendAlert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Trend Alert',
            'type' => 'market_trend',
            'conditions' => ['threshold_percentage' => 3.0],
            'is_active' => true,
        ]);

        $userAlerts = $this->alertRepository->getActiveUserAlerts($this->user->id);

        $this->assertCount(3, $userAlerts);
        $this->assertTrue($userAlerts->contains('type', 'price_change'));
        $this->assertTrue($userAlerts->contains('type', 'competitor_move'));
        $this->assertTrue($userAlerts->contains('type', 'market_trend'));
    }

    public function test_alert_statistics_calculation()
    {
        // Create alerts with different states
        AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Active Alert',
            'type' => 'price_change',
            'conditions' => [],
            'is_active' => true,
            'last_triggered_at' => now()->subHours(2),
        ]);

        AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Inactive Alert',
            'type' => 'competitor_move',
            'conditions' => [],
            'is_active' => false,
        ]);

        $stats = $this->alertRepository->getUserAlertStats($this->user->id);

        $this->assertEquals(2, $stats['total']);
        $this->assertEquals(1, $stats['active']);
        $this->assertEquals(1, $stats['inactive']);
        $this->assertEquals(1, $stats['triggered_today']);
    }

    public function test_competitor_move_alert_evaluation()
    {
        // Create competitor station
        $competitor = Station::create([
            'numero' => 'COMP001',
            'nombre' => 'Competitor Station',
            'brand' => 'Competitor Brand',
            'lat' => 19.4330,
            'lng' => -99.1330,
            'municipio_id' => 1,
            'is_active' => true,
        ]);

        $alert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Competitor Move Alert',
            'type' => 'competitor_move',
            'conditions' => [
                'threshold_percentage' => 2.0,
                'competitor_stations' => ['COMP001'],
                'radius_km' => 5,
            ],
            'is_active' => true,
        ]);

        // Create competitor price changes
        PriceChange::create([
            'station_numero' => 'COMP001',
            'fuel_type' => 'regular',
            'price' => 20.0,
            'changed_at' => now()->subHours(2),
            'detected_at' => now()->subHours(2),
        ]);

        PriceChange::create([
            'station_numero' => 'COMP001',
            'fuel_type' => 'regular',
            'price' => 20.5, // 2.5% increase
            'changed_at' => now()->subMinutes(30),
            'detected_at' => now()->subMinutes(30),
        ]);

        $competitorChanges = $this->analyticsRepository->getRecentPriceChanges(['COMP001'], 1);

        $result = $this->alertRepository->evaluateCompetitorMoveAlert(
            $alert,
            $competitorChanges->toArray()
        );

        $this->assertTrue($result);
    }

    public function test_market_trend_alert_evaluation()
    {
        $alert = AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Market Trend Alert',
            'type' => 'market_trend',
            'conditions' => [
                'fuel_types' => ['regular'],
                'threshold_percentage' => 2.0,
            ],
            'is_active' => true,
        ]);

        $marketData = [
            'regular' => [
                'change_percentage' => 3.0, // Above threshold
                'std_deviation' => 1.5,
                'average' => 22.0,
                'minimum' => 20.0,
                'maximum' => 24.0,
            ],
        ];

        $result = $this->alertRepository->evaluateMarketTrendAlert($alert, $marketData);

        $this->assertTrue($result);
    }

    public function test_alert_creation_and_deletion()
    {
        $alertData = [
            'user_id' => $this->user->id,
            'name' => 'Test Alert',
            'type' => 'price_change',
            'conditions' => [
                'fuel_types' => ['regular', 'premium'],
                'threshold_percentage' => 2.5,
            ],
            'is_active' => true,
        ];

        $alert = $this->alertRepository->create($alertData);

        $this->assertInstanceOf(AlertConfiguration::class, $alert);
        $this->assertEquals('Test Alert', $alert->name);
        $this->assertEquals($this->user->id, $alert->user_id);

        $deleted = $this->alertRepository->delete($alert->id);

        $this->assertTrue($deleted);
        $this->assertNull(AlertConfiguration::find($alert->id));
    }
}
