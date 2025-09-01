<?php

namespace Tests\Feature\Telegram;

use Tests\TestCase;
use App\Models\User;
use App\Models\Station;
use App\Models\UserStation;
use App\Models\PriceChange;
use App\Models\AlertConfiguration;
use App\Services\External\DeepSeekService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Telegram\Bot\Laravel\Facades\Telegram;
use Mockery;

class AnalyticsCommandsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedTestData();
        
        // Mock Telegram facade
        Telegram::shouldReceive('commandsHandler')->andReturn(true);
    }

    private function seedTestData(): void
    {
        // Create test user
        $this->user = User::factory()->create([
            'telegram_chat_id' => '123456789'
        ]);

        // Create test station
        $this->station = Station::create([
            'numero' => 'TEST001',
            'nombre' => 'Test Station',
            'brand' => 'Test Brand',
            'lat' => 19.4326,
            'lng' => -99.1332,
            'municipio_id' => 1,
            'is_active' => true
        ]);

        // Create competitor stations
        for ($i = 2; $i <= 5; $i++) {
            Station::create([
                'numero' => "TEST00{$i}",
                'nombre' => "Competitor {$i}",
                'brand' => 'Brand ' . $i,
                'lat' => 19.4326 + ($i * 0.001),
                'lng' => -99.1332 + ($i * 0.001),
                'municipio_id' => 1,
                'is_active' => true
            ]);
        }

        // Associate station with user
        UserStation::create([
            'user_id' => $this->user->id,
            'station_numero' => $this->station->numero,
            'alias' => 'mi estación',
            'is_default' => true
        ]);

        // Create comprehensive price data
        $this->createCompletePriceData();
    }

    private function createCompletePriceData(): void
    {
        $stations = ['TEST001', 'TEST002', 'TEST003', 'TEST004', 'TEST005'];
        $fuelTypes = ['regular', 'premium', 'diesel'];
        $basePrices = [
            'TEST001' => ['regular' => 22.50, 'premium' => 24.50, 'diesel' => 23.00],
            'TEST002' => ['regular' => 22.00, 'premium' => 24.00, 'diesel' => 22.50],
            'TEST003' => ['regular' => 22.80, 'premium' => 24.80, 'diesel' => 23.30],
            'TEST004' => ['regular' => 21.90, 'premium' => 23.90, 'diesel' => 22.40],
            'TEST005' => ['regular' => 23.00, 'premium' => 25.00, 'diesel' => 23.50],
        ];
        
        foreach ($stations as $stationNumero) {
            foreach ($fuelTypes as $fuel) {
                // Current price
                PriceChange::create([
                    'station_numero' => $stationNumero,
                    'fuel_type' => $fuel,
                    'price' => $basePrices[$stationNumero][$fuel],
                    'changed_at' => now(),
                    'detected_at' => now()
                ]);
                
                // Historical prices for 7 days
                for ($i = 1; $i <= 7; $i++) {
                    PriceChange::create([
                        'station_numero' => $stationNumero,
                        'fuel_type' => $fuel,
                        'price' => $basePrices[$stationNumero][$fuel] - ($i * 0.05),
                        'changed_at' => now()->subDays($i),
                        'detected_at' => now()->subDays($i)
                    ]);
                }
            }
        }
    }

    public function test_tendencia_command_execution()
    {
        Telegram::shouldReceive('sendChatAction')
            ->once()
            ->with(['chat_id' => '123456789', 'action' => 'typing']);
        
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return isset($params['chat_id']) &&
                       $params['chat_id'] == '123456789' &&
                       isset($params['text']) &&
                       str_contains($params['text'], 'Tendencia de Precios') &&
                       str_contains($params['text'], '▁') && // Contains sparkline characters
                       isset($params['parse_mode']) &&
                       $params['parse_mode'] === 'Markdown';
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/tendencia',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_ranking_command_execution()
    {
        Telegram::shouldReceive('sendChatAction')
            ->once()
            ->with(['chat_id' => '123456789', 'action' => 'typing']);
        
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], 'Tu Posición Competitiva') &&
                       str_contains($params['text'], '#') && // Position indicators
                       str_contains($params['text'], 'Top'); // Percentile info
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/ranking',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_historial_command_with_days_parameter()
    {
        Telegram::shouldReceive('sendChatAction')
            ->once()
            ->with(['chat_id' => '123456789', 'action' => 'typing']);
        
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], 'Historial de Precios') &&
                       str_contains($params['text'], 'Últimos 14 días') &&
                       str_contains($params['text'], 'Fecha');
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/historial 14',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_alerta_cambios_create_new_alert()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], 'Alerta creada exitosamente') &&
                       str_contains($params['text'], 'Cambio de precio');
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/alerta_cambios nueva price_change 2 regular',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
        
        // Verify alert was created in database
        $this->assertDatabaseHas('alert_configurations', [
            'user_id' => $this->user->id,
            'type' => 'price_change',
            'is_active' => true
        ]);
    }

    public function test_alerta_cambios_list_alerts()
    {
        // Create some test alerts
        AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Test Alert 1',
            'type' => 'price_change',
            'conditions' => ['threshold_percentage' => 2.0],
            'is_active' => true
        ]);

        AlertConfiguration::create([
            'user_id' => $this->user->id,
            'name' => 'Test Alert 2',
            'type' => 'competitor_move',
            'conditions' => ['threshold_percentage' => 1.5],
            'is_active' => false
        ]);

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], 'Tus Alertas Configuradas') &&
                       str_contains($params['text'], 'Test Alert 1') &&
                       str_contains($params['text'], 'Test Alert 2') &&
                       str_contains($params['text'], '✅') && // Active indicator
                       str_contains($params['text'], '🔴'); // Inactive indicator
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/alerta_cambios lista',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_recomendacion_command_with_ai()
    {
        // Mock DeepSeek service
        $mockDeepSeek = Mockery::mock(DeepSeekService::class);
        $mockDeepSeek->shouldReceive('generatePricingRecommendation')
            ->once()
            ->andReturn([
                'recommendation' => 'Mantén tus precios actuales. El mercado está estable.',
                'suggested_actions' => [
                    'Monitorear competidores cercanos',
                    'Revisar tendencias semanalmente'
                ],
                'risk_level' => 'low',
                'confidence' => 0.85,
                'reasoning' => 'Análisis basado en tendencias estables',
                'ai_generated' => true
            ]);
        
        $this->app->instance(DeepSeekService::class, $mockDeepSeek);
        
        Telegram::shouldReceive('sendChatAction')
            ->once()
            ->with(['chat_id' => '123456789', 'action' => 'typing']);
        
        Telegram::shouldReceive('sendMessage')
            ->twice() // Once for "analyzing" message, once for recommendation
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/recomendacion',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_performance_under_3_seconds()
    {
        $startTime = microtime(true);
        
        Telegram::shouldReceive('sendChatAction')->once();
        Telegram::shouldReceive('sendMessage')->once()->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/tendencia',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $executionTime = microtime(true) - $startTime;
        
        $response->assertOk();
        $this->assertLessThan(3, $executionTime, 'Command execution exceeded 3 seconds');
    }

    public function test_cache_hit_for_repeated_requests()
    {
        // First request - should populate cache
        Telegram::shouldReceive('sendChatAction')->twice();
        Telegram::shouldReceive('sendMessage')->twice()->andReturn((object)['message_id' => 1]);

        $response1 = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/ranking',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        // Second request - should use cache
        $startTime = microtime(true);
        
        $response2 = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/ranking',
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $cachedExecutionTime = microtime(true) - $startTime;
        
        $response1->assertOk();
        $response2->assertOk();
        
        // Cached request should be faster
        $this->assertLessThan(1, $cachedExecutionTime, 'Cached request took too long');
    }

    public function test_command_with_invalid_parameters()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], '❌'); // Error indicator
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/historial 999', // Invalid days parameter (max 30)
                'chat' => ['id' => '123456789'],
                'from' => ['id' => 123456789]
            ]
        ]);

        $response->assertOk();
    }

    public function test_unregistered_user_receives_error()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($params) {
                return str_contains($params['text'], 'Usuario no registrado');
            }))
            ->andReturn((object)['message_id' => 1]);

        $response = $this->post('/api/v1/telegram/webhook', [
            'message' => [
                'text' => '/tendencia',
                'chat' => ['id' => '999999999'], // Non-existent user
                'from' => ['id' => 999999999]
            ]
        ]);

        $response->assertOk();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}