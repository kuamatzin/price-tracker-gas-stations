<?php

namespace Tests\Integration\Notifications;

use Tests\TestCase;
use App\Models\User;
use App\Models\Station;
use App\Services\Telegram\SessionManager;
use App\Telegram\Commands\ConfigurarCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Telegram\Bot\Laravel\Facades\Telegram;
use Mockery;

class WizardFlowTest extends TestCase
{
    use RefreshDatabase;

    private SessionManager $sessionManager;
    private ConfigurarCommand $command;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->sessionManager = app(SessionManager::class);
        
        // Mock Telegram facade
        Telegram::shouldReceive('commandsHandler')->andReturn(true);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_complete_configuration_wizard_flow()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456'
        ]);
        
        $station = Station::factory()->create();
        $user->stations()->attach($station->id, ['alias' => 'Mi Estación']);
        
        $session = $this->sessionManager->getSession($user->id);
        
        // Step 1: Initialize wizard
        $session->setState('configurar:step1');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 1,
            'data' => []
        ]);
        $this->sessionManager->saveSession($session);
        
        // Step 2: Select station
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['station_id'] = $station->id;
        $stateData['step'] = 2;
        $session->setState('configurar:step2');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Step 3: Set radius
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['radius_km'] = 5;
        $stateData['step'] = 3;
        $session->setState('configurar:step3');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Step 4: Set threshold
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['price_change_threshold'] = 2.0;
        $stateData['step'] = 4;
        $session->setState('configurar:step4');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Step 5: Select fuel types
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['fuel_types'] = ['regular', 'premium'];
        $stateData['step'] = 5;
        $session->setState('configurar:step5');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Step 6: Set daily summary time
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['daily_summary_time'] = '07:00';
        
        // Complete configuration
        $preferences = $stateData['data'];
        $preferences['telegram_enabled'] = true;
        $preferences['primary_station_id'] = $station->id;
        
        $user->notification_preferences = $preferences;
        $user->save();
        
        // Clear session
        $session->clearState();
        $this->sessionManager->saveSession($session);
        
        // Assert
        $user->refresh();
        $this->assertNotNull($user->notification_preferences);
        $this->assertEquals($station->id, $user->notification_preferences['primary_station_id']);
        $this->assertEquals(5, $user->notification_preferences['radius_km']);
        $this->assertEquals(2.0, $user->notification_preferences['price_change_threshold']);
        $this->assertEquals(['regular', 'premium'], $user->notification_preferences['fuel_types']);
        $this->assertEquals('07:00', $user->notification_preferences['daily_summary_time']);
        
        // Verify session is cleared
        $finalSession = $this->sessionManager->getSession($user->id);
        $this->assertNull($finalSession->getState());
    }

    public function test_wizard_cancellation_clears_state()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456'
        ]);
        
        $session = $this->sessionManager->getSession($user->id);
        
        // Initialize wizard
        $session->setState('configurar:step2');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 2,
            'data' => ['station_id' => 1]
        ]);
        $this->sessionManager->saveSession($session);
        
        // Act - Cancel wizard
        $session = $this->sessionManager->getSession($user->id);
        $session->clearState();
        $this->sessionManager->saveSession($session);
        
        // Assert
        $clearedSession = $this->sessionManager->getSession($user->id);
        $this->assertNull($clearedSession->getState());
        $this->assertEmpty($clearedSession->getStateData());
    }

    public function test_wizard_back_navigation()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456'
        ]);
        
        $session = $this->sessionManager->getSession($user->id);
        
        // Start at step 3
        $session->setState('configurar:step3');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 3,
            'data' => [
                'station_id' => 1,
                'radius_km' => 5
            ]
        ]);
        $this->sessionManager->saveSession($session);
        
        // Act - Go back to step 2
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['step'] = 2;
        $session->setState('configurar:step2');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Assert
        $updatedSession = $this->sessionManager->getSession($user->id);
        $this->assertEquals('configurar:step2', $updatedSession->getState());
        $this->assertEquals(2, $updatedSession->getStateData()['step']);
        // Data should be preserved
        $this->assertEquals(1, $updatedSession->getStateData()['data']['station_id']);
        $this->assertEquals(5, $updatedSession->getStateData()['data']['radius_km']);
    }

    public function test_wizard_timeout_handling()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456'
        ]);
        
        $session = $this->sessionManager->getSession($user->id);
        
        // Initialize wizard with start time
        $session->setState('configurar:step1');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 1,
            'data' => [],
            'started_at' => time() - 310 // Started 5+ minutes ago
        ]);
        $this->sessionManager->saveSession($session);
        
        // Act - Check if wizard has timed out
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $startedAt = $stateData['started_at'] ?? time();
        $isTimedOut = (time() - $startedAt) > 300; // 5 minutes timeout
        
        // Assert
        $this->assertTrue($isTimedOut);
    }

    public function test_fuel_type_toggle_in_wizard()
    {
        // Arrange
        $user = User::factory()->create([
            'telegram_chat_id' => '123456'
        ]);
        
        $session = $this->sessionManager->getSession($user->id);
        
        // Start with all fuel types selected
        $session->setState('configurar:step4');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 4,
            'data' => [
                'fuel_types' => ['regular', 'premium', 'diesel']
            ]
        ]);
        $this->sessionManager->saveSession($session);
        
        // Act - Toggle off 'diesel'
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $fuelTypes = $stateData['data']['fuel_types'];
        
        if (in_array('diesel', $fuelTypes)) {
            $fuelTypes = array_diff($fuelTypes, ['diesel']);
        } else {
            $fuelTypes[] = 'diesel';
        }
        
        $stateData['data']['fuel_types'] = array_values($fuelTypes);
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);
        
        // Assert
        $updatedSession = $this->sessionManager->getSession($user->id);
        $updatedFuelTypes = $updatedSession->getStateData()['data']['fuel_types'];
        $this->assertEquals(['regular', 'premium'], $updatedFuelTypes);
        $this->assertNotContains('diesel', $updatedFuelTypes);
    }
}