<?php

namespace Tests\Unit\Telegram\Commands;

use App\Models\User;
use App\Services\Telegram\PricingService;
use App\Services\Telegram\TableFormatter;
use App\Telegram\Commands\PreciosTodasCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PreciosTodasCommandTest extends TestCase
{
    use RefreshDatabase;

    private $pricingService;

    private $formatter;

    private $command;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pricingService = Mockery::mock(PricingService::class);
        $this->formatter = Mockery::mock(TableFormatter::class);

        $this->command = new PreciosTodasCommand(
            $this->pricingService,
            $this->formatter
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_shows_all_stations_prices()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock stations data
        $allPrices = collect([
            [
                'station' => (object) [
                    'alias' => 'oficina',
                    'nombre' => 'Pemex Centro',
                ],
                'prices' => collect([
                    (object) ['fuel_type' => 'regular', 'price' => 22.50],
                    (object) ['fuel_type' => 'premium', 'price' => 24.80],
                ]),
                'history' => collect(),
            ],
            [
                'station' => (object) [
                    'alias' => 'casa',
                    'nombre' => 'Shell Norte',
                ],
                'prices' => collect([
                    (object) ['fuel_type' => 'regular', 'price' => 22.85],
                    (object) ['fuel_type' => 'premium', 'price' => 25.10],
                ]),
                'history' => collect(),
            ],
        ]);

        // Mock services
        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn(collect([
                (object) ['id' => 1],
                (object) ['id' => 2],
            ]));

        $this->pricingService->shouldReceive('getAllUserStationPrices')
            ->once()
            ->with($user->id)
            ->andReturn($allPrices);

        $this->formatter->shouldReceive('formatCompactStationPrices')
            ->twice()
            ->andReturn('Station prices');

        $update = $this->createMockUpdate(123456, '/precios_todas');
        $this->command->setUpdate($update);
        $this->command->handle();

        $this->assertTrue(true);
    }

    public function test_finds_best_prices_across_stations()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        // Mock data with different prices
        $allPrices = collect([
            [
                'station' => (object) ['alias' => 'oficina'],
                'prices' => collect([
                    (object) ['fuel_type' => 'regular', 'price' => 22.50],
                    (object) ['fuel_type' => 'premium', 'price' => 25.10],
                ]),
                'history' => collect(),
            ],
            [
                'station' => (object) ['alias' => 'casa'],
                'prices' => collect([
                    (object) ['fuel_type' => 'regular', 'price' => 22.30], // Best regular
                    (object) ['fuel_type' => 'premium', 'price' => 24.80],  // Best premium
                ]),
                'history' => collect(),
            ],
        ]);

        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn(collect([
                (object) ['id' => 1],
                (object) ['id' => 2],
            ]));

        $this->pricingService->shouldReceive('getAllUserStationPrices')
            ->once()
            ->andReturn($allPrices);

        $this->formatter->shouldReceive('formatCompactStationPrices')
            ->twice()
            ->andReturn('Station prices');

        $update = $this->createMockUpdate(123456, '/precios_todas');
        $this->command->setUpdate($update);

        // Should include best prices summary
        $this->expectOutputRegex('/Mejores Precios/');

        $this->command->handle();
    }

    public function test_handles_no_prices_available()
    {
        // Create test user
        $user = User::factory()->create([
            'telegram_chat_id' => 123456,
        ]);

        $this->pricingService->shouldReceive('getUserStations')
            ->once()
            ->andReturn(collect([(object) ['id' => 1]]));

        $this->pricingService->shouldReceive('getAllUserStationPrices')
            ->once()
            ->andReturn(collect());

        $update = $this->createMockUpdate(123456, '/precios_todas');
        $this->command->setUpdate($update);

        $this->expectOutputRegex('/No hay precios disponibles/');

        $this->command->handle();
    }

    private function createMockUpdate($chatId, $text)
    {
        $update = Mockery::mock(\Telegram\Bot\Objects\Update::class);
        $message = Mockery::mock(\Telegram\Bot\Objects\Message::class);
        $chat = Mockery::mock(\Telegram\Bot\Objects\Chat::class);

        $chat->shouldReceive('getId')->andReturn($chatId);
        $message->shouldReceive('getChat')->andReturn($chat);
        $message->shouldReceive('getText')->andReturn($text);
        $update->shouldReceive('getMessage')->andReturn($message);

        return $update;
    }
}
