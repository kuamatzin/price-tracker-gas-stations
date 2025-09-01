<?php

namespace Tests\Unit\Services\Telegram;

use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use App\Services\Telegram\AnalyticsService;
use App\Services\Telegram\NotificationService;
use App\Services\Telegram\SparklineGenerator;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\View;
use Mockery;
use Telegram\Bot\Laravel\Facades\Telegram;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
{
    use RefreshDatabase;

    private NotificationService $service;

    private $analyticsService;

    private $sparklineGenerator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->analyticsService = Mockery::mock(AnalyticsService::class);
        $this->sparklineGenerator = Mockery::mock(SparklineGenerator::class);

        $this->service = new NotificationService(
            $this->analyticsService,
            $this->sparklineGenerator
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_send_daily_summary_returns_false_when_user_has_no_telegram_id()
    {
        // Arrange
        $user = User::factory()->create(['telegram_chat_id' => null]);

        // Act
        $result = $this->service->sendDailySummary($user);

        // Assert
        $this->assertFalse($result);
    }

    public function test_send_daily_summary_returns_false_when_disabled_in_preferences()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'daily_summary_enabled' => false,
            ],
        ]);

        // Act
        $result = $this->service->sendDailySummary($user);

        // Assert
        $this->assertFalse($result);
    }

    public function test_send_daily_summary_returns_false_during_silence_period()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'daily_summary_enabled' => true,
                'silence_until' => Carbon::now()->addHour()->toIso8601String(),
            ],
        ]);

        // Act
        $result = $this->service->sendDailySummary($user);

        // Assert
        $this->assertFalse($result);
    }

    public function test_send_daily_summary_sends_notification_successfully()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'daily_summary_enabled' => true,
                'primary_station_id' => 1,
            ],
        ]);

        $station = Station::factory()->create(['id' => 1]);

        PriceChange::create([
            'station_id' => $station->id,
            'fuel_type' => 'regular',
            'price' => 21.50,
            'changed_at' => Carbon::now(),
        ]);

        $this->analyticsService->shouldReceive('getStationAnalytics')
            ->once()
            ->andReturn(['ranking' => ['summary' => 'Position 2 of 5']]);

        View::shouldReceive('make')
            ->once()
            ->andReturn(Mockery::mock(['render' => 'Test summary content']));

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->andReturn(true);

        // Act
        $result = $this->service->sendDailySummary($user);

        // Assert
        $this->assertTrue($result);
    }

    public function test_send_price_alert_checks_threshold_correctly()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'price_alerts_enabled' => true,
                'alert_frequency' => 'instant',
            ],
        ]);

        $station = Station::factory()->create();

        $priceChanges = [
            [
                'fuel_type' => 'regular',
                'old_price' => 20.00,
                'new_price' => 22.00,
            ],
        ];

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->andReturn(true);

        // Act
        $result = $this->service->sendPriceAlert($user, $station, $priceChanges);

        // Assert
        $this->assertTrue($result);
    }

    public function test_send_price_alert_respects_frequency_settings()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'price_alerts_enabled' => true,
                'alert_frequency' => 'daily',
            ],
        ]);

        $station = Station::factory()->create();

        // Simulate that an alert was sent recently
        Cache::put("user:last_alert:{$user->id}:price_alert", Carbon::now()->toIso8601String(), 86400);

        $priceChanges = [
            [
                'fuel_type' => 'regular',
                'old_price' => 20.00,
                'new_price' => 22.00,
            ],
        ];

        // Act
        $result = $this->service->sendPriceAlert($user, $station, $priceChanges);

        // Assert
        $this->assertFalse($result); // Should not send due to frequency limit
    }

    public function test_send_recommendation_formats_message_correctly()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456',
            'notification_preferences' => [
                'recommendations_enabled' => true,
                'recommendation_frequency' => 'daily',
            ],
        ]);

        $recommendation = 'Consider loading fuel today, prices are expected to rise tomorrow.';

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($args) {
                return str_contains($args['text'], '💡 **Recomendación Inteligente**') &&
                       str_contains($args['text'], 'Consider loading fuel today');
            }))
            ->andReturn(true);

        // Act
        $result = $this->service->sendRecommendation($user, $recommendation);

        // Assert
        $this->assertTrue($result);
    }

    public function test_is_in_silence_period_returns_true_when_active()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'silence_until' => Carbon::now()->addHour()->toIso8601String(),
            ],
        ]);

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('isInSilencePeriod');
        $method->setAccessible(true);

        // Act
        $result = $method->invoke($this->service, $user);

        // Assert
        $this->assertTrue($result);
    }

    public function test_is_in_silence_period_returns_false_when_expired()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'silence_until' => Carbon::now()->subHour()->toIso8601String(),
            ],
        ]);

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('isInSilencePeriod');
        $method->setAccessible(true);

        // Act
        $result = $method->invoke($this->service, $user);

        // Assert
        $this->assertFalse($result);
    }

    public function test_should_send_alert_respects_instant_frequency()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'alert_frequency' => 'instant',
            ],
        ]);

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('shouldSendAlert');
        $method->setAccessible(true);

        // Act
        $result = $method->invoke($this->service, $user, 'price_alert');

        // Assert
        $this->assertTrue($result);
    }

    public function test_should_send_alert_respects_hourly_frequency()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'alert_frequency' => 'hourly',
            ],
        ]);

        // Set last alert time to 30 minutes ago
        Cache::put(
            "user:last_alert:{$user->id}:price_alert",
            Carbon::now()->subMinutes(30)->toIso8601String(),
            86400
        );

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('shouldSendAlert');
        $method->setAccessible(true);

        // Act
        $result = $method->invoke($this->service, $user, 'price_alert');

        // Assert
        $this->assertFalse($result); // Should not send as it hasn't been an hour
    }
}
