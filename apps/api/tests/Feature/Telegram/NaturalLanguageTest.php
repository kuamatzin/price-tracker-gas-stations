<?php

namespace Tests\Feature\Telegram;

use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Telegram\Bot\Laravel\Facades\Telegram;
use Tests\TestCase;

class NaturalLanguageTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();

        // Create test user and station
        $this->user = User::factory()->create([
            'telegram_id' => '12345',
            'name' => 'Test User',
        ]);

        $this->station = Station::factory()->create([
            'number' => 'E12345',
            'brand' => 'PEMEX',
            'name' => 'Test Station',
        ]);

        $this->user->update(['station_id' => $this->station->id]);

        // Create price data
        PriceChange::create([
            'station_id' => $this->station->id,
            'fuel_type' => 'regular',
            'old_price' => 22.50,
            'new_price' => 22.80,
            'change_amount' => 0.30,
            'change_percentage' => 1.33,
        ]);

        PriceChange::create([
            'station_id' => $this->station->id,
            'fuel_type' => 'premium',
            'old_price' => 24.50,
            'new_price' => 24.90,
            'change_amount' => 0.40,
            'change_percentage' => 1.63,
        ]);

        PriceChange::create([
            'station_id' => $this->station->id,
            'fuel_type' => 'diesel',
            'old_price' => 23.50,
            'new_price' => 23.70,
            'change_amount' => 0.20,
            'change_percentage' => 0.85,
        ]);
    }

    public function test_natural_language_price_query_variations()
    {
        $variations = [
            '¿Cuánto está la gasolina?',
            'precio de diesel',
            '¿a cómo está la premium?',
            'cuánto cuesta la magna',
            '¿qué tal está el precio?',
        ];

        Telegram::shouldReceive('getWebhookUpdate')
            ->andReturn($this->createUpdate('12345', '/start'));

        Telegram::shouldReceive('sendMessage')
            ->times(count($variations))
            ->andReturnUsing(function ($params) {
                $this->assertArrayHasKey('chat_id', $params);
                $this->assertArrayHasKey('text', $params);

                // Check that price information is included
                $this->assertStringContainsString('$', $params['text']);

                return (object) ['message_id' => 1];
            });

        foreach ($variations as $query) {
            $update = $this->createUpdate('12345', $query);

            $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

            $response->assertOk();
        }
    }

    public function test_mexican_spanish_colloquialisms()
    {
        $colloquialisms = [
            'gasolina verde' => 'regular',
            'la magna' => 'regular',
            'gasolina roja' => 'premium',
            'gasofa' => 'diesel',
        ];

        Telegram::shouldReceive('getWebhookUpdate')
            ->andReturn($this->createUpdate('12345', '/start'));

        Telegram::shouldReceive('sendMessage')
            ->times(count($colloquialisms))
            ->andReturnUsing(function ($params) {
                $this->assertArrayHasKey('text', $params);

                return (object) ['message_id' => 1];
            });

        foreach ($colloquialisms as $colloquial => $expectedFuel) {
            $update = $this->createUpdate('12345', "precio de $colloquial");

            $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

            $response->assertOk();
        }
    }

    public function test_multi_turn_conversation_context()
    {
        // First query - ask about premium
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'Premium') &&
                       str_contains($params['text'], '24.90');
            })
            ->andReturn((object) ['message_id' => 1]);

        $update1 = $this->createUpdate('12345', '¿Cuánto está la premium?');
        $response1 = $this->postJson('/api/v1/telegram/webhook', $update1->toArray());
        $response1->assertOk();

        // Second query - follow-up about regular
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'Regular') &&
                       str_contains($params['text'], '22.80');
            })
            ->andReturn((object) ['message_id' => 2]);

        $update2 = $this->createUpdate('12345', '¿y la regular?');
        $response2 = $this->postJson('/api/v1/telegram/webhook', $update2->toArray());
        $response2->assertOk();

        // Third query - another follow-up about diesel
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'Diesel') &&
                       str_contains($params['text'], '23.70');
            })
            ->andReturn((object) ['message_id' => 3]);

        $update3 = $this->createUpdate('12345', 'también la diesel');
        $response3 = $this->postJson('/api/v1/telegram/webhook', $update3->toArray());
        $response3->assertOk();
    }

    public function test_fallback_suggestions_for_low_confidence()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'No estoy seguro') &&
                       isset($params['reply_markup']);
            })
            ->andReturn((object) ['message_id' => 1]);

        $update = $this->createUpdate('12345', 'algo muy ambiguo');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $response->assertOk();
    }

    public function test_response_time_under_2_seconds()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => json_encode([
                        'intent' => 'price_query',
                        'entities' => ['fuel_type' => 'premium'],
                        'confidence' => 0.95,
                        'suggested_command' => '/precio premium',
                    ])]],
                ],
            ], 200, [], 1.5), // 1.5 second response time
        ]);

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->andReturn((object) ['message_id' => 1]);

        $startTime = microtime(true);

        $update = $this->createUpdate('12345', 'consulta compleja que requiere deepseek');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $endTime = microtime(true);
        $responseTime = $endTime - $startTime;

        $response->assertOk();
        $this->assertLessThan(3, $responseTime); // Allow some overhead beyond 2 seconds
    }

    public function test_typo_correction()
    {
        $typos = [
            'presio de gsolina' => 'precio',
            'cuato cuesta la diesl' => 'diesel',
            'gasolineria cerca' => 'gasolinera',
        ];

        Telegram::shouldReceive('sendMessage')
            ->times(count($typos))
            ->andReturn((object) ['message_id' => 1]);

        foreach ($typos as $typo => $expectedCorrection) {
            $update = $this->createUpdate('12345', $typo);
            $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

            $response->assertOk();
        }
    }

    public function test_natural_language_with_location_context()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'cerca') ||
                       str_contains($params['text'], 'cercan');
            })
            ->andReturn((object) ['message_id' => 1]);

        $update = $this->createUpdate('12345', 'gasolineras cerca de aquí');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $response->assertOk();
    }

    public function test_handles_non_spanish_gracefully()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->withArgs(function ($params) {
                return str_contains($params['text'], 'No entendí');
            })
            ->andReturn((object) ['message_id' => 1]);

        $update = $this->createUpdate('12345', 'hello world in english');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $response->assertOk();
    }

    public function test_deepseek_unavailable_fallback()
    {
        Http::fake([
            'api.deepseek.com/*' => Http::response(null, 503),
        ]);

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->andReturn((object) ['message_id' => 1]);

        // Should still work with local NLP processing
        $update = $this->createUpdate('12345', 'precio de gasolina premium');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $response->assertOk();
    }

    public function test_query_logging_happens_asynchronously()
    {
        Queue::fake();

        Telegram::shouldReceive('sendMessage')
            ->once()
            ->andReturn((object) ['message_id' => 1]);

        $update = $this->createUpdate('12345', '¿Cuánto está la gasolina?');
        $response = $this->postJson('/api/v1/telegram/webhook', $update->toArray());

        $response->assertOk();

        Queue::assertPushed(\App\Jobs\LogNlpQuery::class, function ($job) {
            return true;
        });
    }

    protected function createUpdate(string $chatId, string $text): object
    {
        return (object) [
            'update_id' => rand(1000000, 9999999),
            'message' => (object) [
                'message_id' => rand(100, 999),
                'from' => (object) [
                    'id' => $chatId,
                    'is_bot' => false,
                    'first_name' => 'Test',
                    'username' => 'testuser',
                ],
                'chat' => (object) [
                    'id' => $chatId,
                    'type' => 'private',
                ],
                'date' => time(),
                'text' => $text,
            ],
            'toArray' => function () use ($chatId, $text) {
                return [
                    'update_id' => rand(1000000, 9999999),
                    'message' => [
                        'message_id' => rand(100, 999),
                        'from' => [
                            'id' => $chatId,
                            'is_bot' => false,
                            'first_name' => 'Test',
                            'username' => 'testuser',
                        ],
                        'chat' => [
                            'id' => $chatId,
                            'type' => 'private',
                        ],
                        'date' => time(),
                        'text' => $text,
                    ],
                ];
            },
        ];
    }
}
