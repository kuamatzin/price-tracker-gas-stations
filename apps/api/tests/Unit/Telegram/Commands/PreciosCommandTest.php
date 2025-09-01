<?php

namespace Tests\Unit\Telegram\Commands;

use App\Models\User;
use App\Services\Telegram\InlineKeyboardBuilder;
use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use App\Telegram\Commands\PreciosCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Telegram\Bot\Objects\Chat;
use Telegram\Bot\Objects\Message;
use Telegram\Bot\Objects\Update;
use Tests\TestCase;

class PreciosCommandTest extends TestCase
{
    use RefreshDatabase;

    private $pricingService;

    private $formatter;

    private $keyboardBuilder;

    private $command;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pricingService = Mockery::mock(PricingService::class);
        $this->formatter = Mockery::mock(TableFormatter::class);
        $this->keyboardBuilder = Mockery::mock(InlineKeyboardBuilder::class);

        $this->command = new PreciosCommand(
            $this->pricingService,
            $this->formatter,
            $this->keyboardBuilder
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_handles_user_with_no_stations()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock update
        $update = $this->createMockUpdate(123456, '/precios');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->with($user->id)
            ->andReturn(collect());

        $this->command->setUpdate($update);

        // Assert response contains error message
        $this->expectOutputRegex('/No tienes estaciones registradas/');

        $this->command->handle();
    }

    public function test_handles_single_station_user()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock station data
        $station = (object) [
            'id' => 1,
            'alias' => 'oficina',
            'station_numero' => 'E12345',
            'nombre' => 'Pemex Centro',
            'direccion' => 'Av. Centro 123',
            'is_default' => true,
        ];

        // Mock prices
        $prices = collect([
            (object) ['fuel_type' => 'regular', 'price' => 22.50],
            (object) ['fuel_type' => 'premium', 'price' => 24.80],
            (object) ['fuel_type' => 'diesel', 'price' => 23.60],
        ]);

        // Mock update
        $update = $this->createMockUpdate(123456, '/precios');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->with($user->id)
            ->andReturn(collect([$station]));

        $this->pricingService->shouldReceive('getCurrentStationPrices')
            ->once()
            ->with('E12345', null)
            ->andReturn($prices);

        $this->pricingService->shouldReceive('getPriceHistory')
            ->once()
            ->with('E12345', 1)
            ->andReturn(collect());

        $this->formatter->shouldReceive('formatStationPrices')
            ->once()
            ->andReturn('💰 Precios Actuales - oficina');

        $this->command->setUpdate($update);
        $this->command->handle();

        $this->assertTrue(true); // Command executed without errors
    }

    public function test_handles_station_alias_parameter()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock stations
        $stations = collect([
            (object) ['id' => 1, 'alias' => 'oficina', 'station_numero' => 'E12345'],
            (object) ['id' => 2, 'alias' => 'casa', 'station_numero' => 'E67890'],
        ]);

        // Mock update with alias parameter
        $update = $this->createMockUpdate(123456, '/precios casa');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->with($user->id)
            ->andReturn($stations);

        $this->pricingService->shouldReceive('getCurrentStationPrices')
            ->once()
            ->with('E67890', null)
            ->andReturn(collect());

        $this->pricingService->shouldReceive('getPriceHistory')
            ->once()
            ->andReturn(collect());

        $this->formatter->shouldReceive('formatStationPrices')
            ->once()
            ->andReturn('Prices for casa');

        $this->command->setUpdate($update);
        $this->command->handle();

        $this->assertTrue(true);
    }

    public function test_handles_fuel_type_filter()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock station
        $station = (object) [
            'id' => 1,
            'alias' => 'oficina',
            'station_numero' => 'E12345',
        ];

        // Mock update with fuel type
        $update = $this->createMockUpdate(123456, '/precios premium');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn(collect([$station]));

        $this->pricingService->shouldReceive('getCurrentStationPrices')
            ->once()
            ->with('E12345', 'premium')
            ->andReturn(collect([
                (object) ['fuel_type' => 'premium', 'price' => 24.80],
            ]));

        $this->pricingService->shouldReceive('getPriceHistory')
            ->once()
            ->andReturn(collect());

        $this->formatter->shouldReceive('formatStationPrices')
            ->once()
            ->andReturn('Premium prices');

        $this->command->setUpdate($update);
        $this->command->handle();

        $this->assertTrue(true);
    }

    public function test_shows_station_selection_for_multiple_stations_no_default()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock stations without default
        $stations = collect([
            (object) ['id' => 1, 'alias' => 'oficina', 'is_default' => false],
            (object) ['id' => 2, 'alias' => 'casa', 'is_default' => false],
        ]);

        // Mock update
        $update = $this->createMockUpdate(123456, '/precios');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn($stations);

        $this->keyboardBuilder->shouldReceive('buildStationSelection')
            ->once()
            ->with($stations, 'precios')
            ->andReturn('{"inline_keyboard":[]}');

        $this->command->setUpdate($update);

        // Should show selection keyboard
        $this->expectOutputRegex('/Selecciona una estación/');

        $this->command->handle();
    }

    public function test_handles_invalid_station_alias()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock stations
        $stations = collect([
            (object) ['id' => 1, 'alias' => 'oficina'],
            (object) ['id' => 2, 'alias' => 'casa'],
        ]);

        // Mock update with invalid alias
        $update = $this->createMockUpdate(123456, '/precios invalida');

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn($stations);

        $this->command->setUpdate($update);

        // Should show error
        $this->expectOutputRegex('/No encontré la estación/');

        $this->command->handle();
    }

    private function createMockUpdate($chatId, $text)
    {
        $update = Mockery::mock(Update::class);
        $message = Mockery::mock(Message::class);
        $chat = Mockery::mock(Chat::class);

        $chat->shouldReceive('getId')->andReturn($chatId);
        $message->shouldReceive('getChat')->andReturn($chat);
        $message->shouldReceive('getText')->andReturn($text);
        $update->shouldReceive('getMessage')->andReturn($message);

        // Mock arguments parsing
        $parts = explode(' ', $text);
        array_shift($parts); // Remove command
        $update->shouldReceive('getMessage->getText')->andReturn($text);

        return $update;
    }
}
