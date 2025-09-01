<?php

namespace Tests\Unit\Repositories;

use Tests\TestCase;
use App\Repositories\UserPreferenceRepository;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class UserPreferenceRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private UserPreferenceRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new UserPreferenceRepository();
    }

    public function test_get_preferences_returns_defaults_when_user_has_no_preferences()
    {
        // Arrange
        $user = User::factory()->create(['notification_preferences' => null]);
        
        // Act
        $preferences = $this->repository->getPreferences($user);
        
        // Assert
        $this->assertIsArray($preferences);
        $this->assertTrue($preferences['daily_summary_enabled']);
        $this->assertEquals('07:00', $preferences['daily_summary_time']);
        $this->assertEquals(2.0, $preferences['price_change_threshold']);
        $this->assertEquals(5, $preferences['alert_radius_km']);
    }

    public function test_get_preferences_returns_cached_data()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => ['custom' => 'value']
        ]);
        
        // Act - First call should cache
        $preferences1 = $this->repository->getPreferences($user);
        
        // Update user preferences directly in DB
        $user->update([
            'notification_preferences' => ['custom' => 'new_value']
        ]);
        
        // Act - Second call should return cached value
        $preferences2 = $this->repository->getPreferences($user);
        
        // Assert
        $this->assertEquals($preferences1, $preferences2);
        $this->assertEquals('value', $preferences2['custom']);
    }

    public function test_update_preferences_validates_input()
    {
        // Arrange
        $user = User::factory()->create();
        $invalidPreferences = [
            'alert_radius_km' => 100, // Max is 20
            'price_change_threshold' => -5 // Min is 0.1
        ];
        
        // Act & Assert
        $this->expectException(ValidationException::class);
        $this->repository->updatePreferences($user, $invalidPreferences);
    }

    public function test_update_preferences_merges_with_existing()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'daily_summary_enabled' => true,
                'alert_radius_km' => 5
            ]
        ]);
        
        $newPreferences = [
            'alert_radius_km' => 10,
            'price_change_threshold' => 3.0
        ];
        
        // Act
        $result = $this->repository->updatePreferences($user, $newPreferences);
        
        // Assert
        $this->assertTrue($result['daily_summary_enabled']); // Should remain
        $this->assertEquals(10, $result['alert_radius_km']); // Should update
        $this->assertEquals(3.0, $result['price_change_threshold']); // Should add
    }

    public function test_update_preferences_clears_cache()
    {
        // Arrange
        $user = User::factory()->create();
        $cacheKey = "user:preferences:{$user->id}";
        Cache::put($cacheKey, ['cached' => 'value'], 300);
        
        // Act
        $this->repository->updatePreferences($user, ['alert_radius_km' => 10]);
        
        // Assert
        $this->assertFalse(Cache::has($cacheKey));
    }

    public function test_get_notification_settings_returns_correct_structure()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'daily_summary_enabled' => false,
                'alert_frequency' => 'hourly'
            ]
        ]);
        
        // Act
        $settings = $this->repository->getNotificationSettings($user);
        
        // Assert
        $this->assertArrayHasKey('daily_summary_enabled', $settings);
        $this->assertArrayHasKey('daily_summary_time', $settings);
        $this->assertArrayHasKey('price_alerts_enabled', $settings);
        $this->assertArrayHasKey('alert_frequency', $settings);
        $this->assertFalse($settings['daily_summary_enabled']);
        $this->assertEquals('hourly', $settings['alert_frequency']);
    }

    public function test_set_fuel_type_threshold_validates_fuel_type()
    {
        // Arrange
        $user = User::factory()->create();
        
        // Act & Assert
        $this->expectException(\InvalidArgumentException::class);
        $this->repository->setFuelTypeThreshold($user, 'invalid_fuel', 5.0);
    }

    public function test_set_fuel_type_threshold_updates_correctly()
    {
        // Arrange
        $user = User::factory()->create();
        
        // Act
        $result = $this->repository->setFuelTypeThreshold($user, 'regular', 3.5);
        
        // Assert
        $this->assertEquals(3.5, $result['fuel_type_thresholds']['regular']);
    }

    public function test_set_silence_period_stores_datetime()
    {
        // Arrange
        $user = User::factory()->create();
        $silenceUntil = new \DateTime('+2 hours');
        
        // Act
        $result = $this->repository->setSilencePeriod($user, $silenceUntil);
        
        // Assert
        $this->assertNotNull($result['silence_until']);
        $this->assertEquals(
            $silenceUntil->format('Y-m-d H:i:s'),
            $result['silence_until']
        );
    }

    public function test_clear_silence_period_removes_silence_until()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'silence_until' => '2025-12-31 23:59:59',
                'other_setting' => 'value'
            ]
        ]);
        
        // Act
        $result = $this->repository->clearSilencePeriod($user);
        
        // Assert
        $this->assertArrayNotHasKey('silence_until', $result);
        $this->assertArrayHasKey('other_setting', $result);
    }

    public function test_is_in_silence_period_returns_true_when_active()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'silence_until' => Carbon::now()->addHour()->format('Y-m-d H:i:s')
            ]
        ]);
        
        // Act
        $result = $this->repository->isInSilencePeriod($user);
        
        // Assert
        $this->assertTrue($result);
    }

    public function test_is_in_silence_period_returns_false_when_expired()
    {
        // Arrange
        $user = User::factory()->create([
            'notification_preferences' => [
                'silence_until' => Carbon::now()->subHour()->format('Y-m-d H:i:s')
            ]
        ]);
        
        // Act
        $result = $this->repository->isInSilencePeriod($user);
        
        // Assert
        $this->assertFalse($result);
    }

    public function test_get_users_by_notification_time_filters_correctly()
    {
        // Arrange
        User::factory()->create([
            'telegram_chat_id' => '123',
            'notification_preferences' => [
                'daily_summary_enabled' => true,
                'daily_summary_time' => '07:00'
            ]
        ]);
        
        User::factory()->create([
            'telegram_chat_id' => '456',
            'notification_preferences' => [
                'daily_summary_enabled' => true,
                'daily_summary_time' => '08:00'
            ]
        ]);
        
        User::factory()->create([
            'telegram_chat_id' => '789',
            'notification_preferences' => [
                'daily_summary_enabled' => false,
                'daily_summary_time' => '07:00'
            ]
        ]);
        
        // Act
        $users = $this->repository->getUsersByNotificationTime('07:00');
        
        // Assert
        $this->assertEquals(1, $users->count());
        $this->assertEquals('123', $users->first()->telegram_chat_id);
    }

    public function test_get_users_with_price_alerts_enabled_filters_correctly()
    {
        // Arrange
        User::factory()->create([
            'telegram_chat_id' => '123',
            'notification_preferences' => [
                'price_alerts_enabled' => true
            ]
        ]);
        
        User::factory()->create([
            'telegram_chat_id' => '456',
            'notification_preferences' => [
                'price_alerts_enabled' => false
            ]
        ]);
        
        User::factory()->create([
            'telegram_chat_id' => null,
            'notification_preferences' => [
                'price_alerts_enabled' => true
            ]
        ]);
        
        // Act
        $users = $this->repository->getUsersWithPriceAlertsEnabled();
        
        // Assert
        $this->assertEquals(1, $users->count());
        $this->assertEquals('123', $users->first()->telegram_chat_id);
    }

    public function test_update_monitoring_preferences_validates_correctly()
    {
        // Arrange
        $user = User::factory()->create();
        
        $preferences = [
            'alert_radius_km' => 15,
            'fuel_types' => ['regular', 'premium'],
            'competitor_monitoring' => true
        ];
        
        // Act
        $result = $this->repository->updateMonitoringPreferences($user, $preferences);
        
        // Assert
        $this->assertEquals(15, $result['alert_radius_km']);
        $this->assertEquals(['regular', 'premium'], $result['fuel_types']);
        $this->assertTrue($result['competitor_monitoring']);
    }
}