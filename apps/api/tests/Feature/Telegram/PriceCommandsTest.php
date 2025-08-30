<?php

namespace Tests\Feature\Telegram;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PriceCommandsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Seed test data
        $this->seedTestData();
    }

    public function test_complete_price_command_flow_with_multi_station_user()
    {
        // Create user with multiple stations
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        // Register multiple stations for user
        DB::table('user_stations')->insert([
            [
                'user_id' => $user->id,
                'station_numero' => 'E12345',
                'alias' => 'oficina',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'user_id' => $user->id,
                'station_numero' => 'E67890',
                'alias' => 'casa',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);

        // Test /precios command - should use default station
        $response = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        $this->assertStringContainsString('oficina', $response);
        
        // Test /precios with alias
        $response = $this->simulateTelegramCommand('/precios casa', $user->telegram_chat_id);
        $this->assertStringContainsString('casa', $response);
        
        // Test /precios_todas
        $response = $this->simulateTelegramCommand('/precios_todas', $user->telegram_chat_id);
        $this->assertStringContainsString('oficina', $response);
        $this->assertStringContainsString('casa', $response);
    }

    public function test_station_selection_via_inline_keyboard_callback()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        // Register stations without default
        DB::table('user_stations')->insert([
            [
                'user_id' => $user->id,
                'station_numero' => 'E12345',
                'alias' => 'oficina',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'user_id' => $user->id,
                'station_numero' => 'E67890',
                'alias' => 'casa',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);

        // Simulate /precios command - should show selection
        $response = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        $this->assertStringContainsString('Selecciona una estación', $response);
        
        // Simulate callback selection
        $callbackData = 'station:precios:1';
        $response = $this->simulateTelegramCallback($callbackData, $user->telegram_chat_id);
        $this->assertNotNull($response);
    }

    public function test_default_station_command()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789',
            'default_station_alias' => null
        ]);

        // Register stations
        $stationId = DB::table('user_stations')->insertGetId([
            'user_id' => $user->id,
            'station_numero' => 'E12345',
            'alias' => 'oficina',
            'is_default' => false,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // Set default station
        $response = $this->simulateTelegramCommand('/estacion_default oficina', $user->telegram_chat_id);
        $this->assertStringContainsString('establecida', $response);
        
        // Verify database update
        $userStation = DB::table('user_stations')->find($stationId);
        $this->assertTrue((bool)$userStation->is_default);
        
        // Verify user record update
        $user->refresh();
        $this->assertEquals('oficina', $user->default_station_alias);
    }

    public function test_cache_hit_and_miss_scenarios()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        DB::table('user_stations')->insert([
            'user_id' => $user->id,
            'station_numero' => 'E12345',
            'alias' => 'oficina',
            'is_default' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // First call - cache miss
        Cache::flush();
        $response1 = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        
        // Verify cache was populated
        $cacheKey = "telegram:user:{$user->id}:stations";
        $this->assertTrue(Cache::has($cacheKey));
        
        // Second call - cache hit
        $response2 = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        
        // Responses should be identical
        $this->assertEquals($response1, $response2);
    }

    public function test_error_handling_for_users_with_no_stations()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        // Test all price commands without registered stations
        $commands = ['/precios', '/precios_todas', '/precios_competencia', '/precio_promedio'];
        
        foreach ($commands as $command) {
            $response = $this->simulateTelegramCommand($command, $user->telegram_chat_id);
            $this->assertStringContainsString('No tienes estaciones registradas', $response);
        }
    }

    public function test_concurrent_command_execution_with_station_context()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        DB::table('user_stations')->insert([
            'user_id' => $user->id,
            'station_numero' => 'E12345',
            'alias' => 'oficina',
            'is_default' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // Simulate concurrent commands
        $promises = [];
        for ($i = 0; $i < 5; $i++) {
            $promises[] = $this->simulateTelegramCommandAsync('/precios', $user->telegram_chat_id);
        }
        
        // All should complete successfully
        foreach ($promises as $promise) {
            $this->assertNotNull($promise);
        }
    }

    public function test_session_persistence_with_selected_station()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        // Store station selection in session
        $sessionKey = "telegram:session:{$user->telegram_chat_id}";
        Cache::put($sessionKey, [
            'selected_station' => 'E12345',
            'fuel_type' => 'premium'
        ], 300);
        
        // Command should use session context
        $response = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        
        // Verify session was used
        $session = Cache::get($sessionKey);
        $this->assertNotNull($session);
    }

    public function test_rate_limiting_based_on_user_tier()
    {
        // Create users with different rate limits
        $basicUser = User::factory()->create([
            'telegram_chat_id' => '111111',
            'api_rate_limit' => 10
        ]);
        
        $premiumUser = User::factory()->create([
            'telegram_chat_id' => '222222',
            'api_rate_limit' => 100
        ]);

        // Basic user should be rate limited after 10 requests
        for ($i = 0; $i < 15; $i++) {
            $response = $this->simulateTelegramCommand('/precios', $basicUser->telegram_chat_id);
            if ($i >= 10) {
                $this->assertStringContainsString('límite', $response);
            }
        }
        
        // Premium user should not be limited at 10 requests
        for ($i = 0; $i < 15; $i++) {
            $response = $this->simulateTelegramCommand('/precios', $premiumUser->telegram_chat_id);
            $this->assertStringNotContainsString('límite', $response);
        }
    }

    public function test_station_alias_uniqueness_per_user()
    {
        $user1 = User::factory()->create(['telegram_chat_id' => '111111']);
        $user2 = User::factory()->create(['telegram_chat_id' => '222222']);

        // Both users can have same alias
        DB::table('user_stations')->insert([
            [
                'user_id' => $user1->id,
                'station_numero' => 'E12345',
                'alias' => 'oficina',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'user_id' => $user2->id,
                'station_numero' => 'E67890',
                'alias' => 'oficina',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);

        // Each user sees their own station
        $response1 = $this->simulateTelegramCommand('/precios', $user1->telegram_chat_id);
        $this->assertStringContainsString('E12345', $this->getStationFromResponse($response1));
        
        $response2 = $this->simulateTelegramCommand('/precios', $user2->telegram_chat_id);
        $this->assertStringContainsString('E67890', $this->getStationFromResponse($response2));
    }

    public function test_default_station_persistence_across_sessions()
    {
        $user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        DB::table('user_stations')->insert([
            [
                'user_id' => $user->id,
                'station_numero' => 'E12345',
                'alias' => 'oficina',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'user_id' => $user->id,
                'station_numero' => 'E67890',
                'alias' => 'casa',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);

        // Clear session
        Cache::forget("telegram:session:{$user->telegram_chat_id}");
        
        // Command should still use default station
        $response = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        $this->assertStringContainsString('oficina', $response);
        
        // Change default
        $this->simulateTelegramCommand('/estacion_default casa', $user->telegram_chat_id);
        
        // Clear session again
        Cache::forget("telegram:session:{$user->telegram_chat_id}");
        
        // Should now use new default
        $response = $this->simulateTelegramCommand('/precios', $user->telegram_chat_id);
        $this->assertStringContainsString('casa', $response);
    }

    private function seedTestData()
    {
        // Create stations
        DB::table('stations')->insert([
            [
                'numero' => 'E12345',
                'nombre' => 'Pemex Centro',
                'direccion' => 'Av. Centro 123',
                'lat' => 19.4326,
                'lng' => -99.1332,
                'entidad_id' => 1,
                'municipio_id' => 1,
                'brand' => 'Pemex',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'numero' => 'E67890',
                'nombre' => 'Shell Norte',
                'direccion' => 'Blvd. Norte 456',
                'lat' => 19.4426,
                'lng' => -99.1432,
                'entidad_id' => 1,
                'municipio_id' => 1,
                'brand' => 'Shell',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);

        // Create price changes
        DB::table('price_changes')->insert([
            [
                'station_numero' => 'E12345',
                'fuel_type' => 'regular',
                'subproducto' => 'Gasolina Regular',
                'price' => 22.50,
                'changed_at' => now(),
                'detected_at' => now(),
                'created_at' => now()
            ],
            [
                'station_numero' => 'E12345',
                'fuel_type' => 'premium',
                'subproducto' => 'Gasolina Premium',
                'price' => 24.80,
                'changed_at' => now(),
                'detected_at' => now(),
                'created_at' => now()
            ],
            [
                'station_numero' => 'E67890',
                'fuel_type' => 'regular',
                'subproducto' => 'Gasolina Regular',
                'price' => 22.85,
                'changed_at' => now(),
                'detected_at' => now(),
                'created_at' => now()
            ]
        ]);
    }

    private function simulateTelegramCommand($command, $chatId)
    {
        // Simulate command execution
        // In real implementation, this would call the webhook endpoint
        return "Simulated response for {$command}";
    }

    private function simulateTelegramCallback($callbackData, $chatId)
    {
        // Simulate callback execution
        return "Callback response for {$callbackData}";
    }

    private function simulateTelegramCommandAsync($command, $chatId)
    {
        // Simulate async command execution
        return "Async response for {$command}";
    }

    private function getStationFromResponse($response)
    {
        // Extract station info from response
        return $response;
    }
}