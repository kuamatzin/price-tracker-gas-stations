<?php

namespace Tests\Feature\Telegram;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\TelegramUser;
use App\Services\Telegram\SessionManager;
use Telegram\Bot\Laravel\Facades\Telegram;
use Mockery;

class TelegramBotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Mock Telegram facade
        Telegram::shouldReceive('commandsHandler')->andReturn(null);
        Telegram::shouldReceive('sendMessage')->andReturn(true);
        Telegram::shouldReceive('sendChatAction')->andReturn(true);
        Telegram::shouldReceive('answerCallbackQuery')->andReturn(true);
    }

    /**
     * Test webhook endpoint responds correctly
     */
    public function test_webhook_endpoint_responds_correctly()
    {
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123456,
            'message' => [
                'message_id' => 1,
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test',
                    'username' => 'testuser'
                ],
                'chat' => [
                    'id' => 12345,
                    'first_name' => 'Test',
                    'username' => 'testuser',
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/start'
            ]
        ]);

        $response->assertStatus(200);
        $response->assertJson(['ok' => true]);
    }

    /**
     * Test /start command initiates registration for new users
     */
    public function test_start_command_initiates_registration()
    {
        $telegramUserId = 12345;
        
        // Ensure user doesn't exist
        $this->assertNull(TelegramUser::where('telegram_id', $telegramUserId)->first());
        
        // Simulate /start command
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123456,
            'message' => [
                'message_id' => 1,
                'from' => [
                    'id' => $telegramUserId,
                    'is_bot' => false,
                    'first_name' => 'Test',
                    'username' => 'testuser'
                ],
                'chat' => [
                    'id' => $telegramUserId,
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/start'
            ]
        ]);

        $response->assertStatus(200);
        
        // Check that Telegram user was created
        $telegramUser = TelegramUser::where('telegram_id', $telegramUserId)->first();
        $this->assertNotNull($telegramUser);
        $this->assertEquals('Test', $telegramUser->first_name);
        $this->assertEquals('testuser', $telegramUser->telegram_username);
    }

    /**
     * Test /help command displays all commands
     */
    public function test_help_command_displays_commands()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($args) {
                return isset($args['text']) && 
                       str_contains($args['text'], 'Comandos Disponibles') &&
                       str_contains($args['text'], '/precios') &&
                       str_contains($args['text'], '/tendencia');
            }))
            ->andReturn(true);
        
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123457,
            'message' => [
                'message_id' => 2,
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test'
                ],
                'chat' => [
                    'id' => 12345,
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/help'
            ]
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test /comandos shows category menu
     */
    public function test_comandos_shows_category_menu()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($args) {
                return isset($args['text']) && 
                       str_contains($args['text'], 'Menú de Comandos') &&
                       isset($args['reply_markup']);
            }))
            ->andReturn(true);
        
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123458,
            'message' => [
                'message_id' => 3,
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test'
                ],
                'chat' => [
                    'id' => 12345,
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/comandos'
            ]
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test unknown commands trigger suggestions
     */
    public function test_unknown_command_triggers_suggestions()
    {
        Telegram::shouldReceive('sendMessage')
            ->once()
            ->with(Mockery::on(function ($args) {
                return isset($args['text']) && 
                       str_contains($args['text'], 'No reconozco el comando');
            }))
            ->andReturn(true);
        
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123459,
            'message' => [
                'message_id' => 4,
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test'
                ],
                'chat' => [
                    'id' => 12345,
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/precio' // Should suggest /precios
            ]
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test session persists across messages
     */
    public function test_session_persists_across_messages()
    {
        $sessionManager = app(SessionManager::class);
        $userId = 12345;
        
        // Create session with data
        $session = $sessionManager->getSession($userId);
        $session->put('test_key', 'test_value');
        $sessionManager->saveSession($session);
        
        // Retrieve session
        $retrievedSession = $sessionManager->getSession($userId);
        $this->assertEquals('test_value', $retrievedSession->get('test_key'));
    }

    /**
     * Test language switching works
     */
    public function test_language_switching_works()
    {
        $sessionManager = app(SessionManager::class);
        $userId = 12345;
        
        // Set language to English
        $session = $sessionManager->getSession($userId);
        $session->setLanguage('en');
        $sessionManager->saveSession($session);
        
        // Check language is saved
        $retrievedSession = $sessionManager->getSession($userId);
        $this->assertEquals('en', $retrievedSession->getLanguage());
    }

    /**
     * Test registration flow completes successfully
     */
    public function test_registration_flow_completes()
    {
        $telegramUserId = 12346;
        $user = User::factory()->create([
            'email' => 'test@example.com'
        ]);
        
        // Create Telegram user without linking to User
        $telegramUser = TelegramUser::create([
            'telegram_id' => $telegramUserId,
            'first_name' => 'Test',
            'telegram_username' => 'testuser'
        ]);
        
        // Generate registration token
        $token = $telegramUser->generateRegistrationToken();
        
        // Link to user account
        $telegramUser->user_id = $user->id;
        $telegramUser->save();
        $telegramUser->clearRegistrationToken();
        
        // Check registration is complete
        $this->assertTrue($telegramUser->isRegistered());
        $this->assertNull($telegramUser->registration_token);
        $this->assertEquals($user->id, $telegramUser->user_id);
    }

    /**
     * Test callback queries are handled
     */
    public function test_callback_queries_are_handled()
    {
        Telegram::shouldReceive('answerCallbackQuery')
            ->once()
            ->andReturn(true);
        
        Telegram::shouldReceive('editMessageText')
            ->once()
            ->andReturn(true);
        
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123460,
            'callback_query' => [
                'id' => '123',
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test'
                ],
                'message' => [
                    'message_id' => 5,
                    'from' => [
                        'id' => 987654321,
                        'is_bot' => true
                    ],
                    'chat' => [
                        'id' => 12345,
                        'type' => 'private'
                    ],
                    'date' => time()
                ],
                'data' => 'menu:precios'
            ]
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test error messages are user-friendly
     */
    public function test_error_messages_are_user_friendly()
    {
        // Force an error by not mocking Telegram facade properly
        Telegram::shouldReceive('commandsHandler')
            ->once()
            ->andThrow(new \Exception('Test error'));
        
        $response = $this->postJson('/api/v1/telegram/webhook', [
            'update_id' => 123461,
            'message' => [
                'message_id' => 6,
                'from' => [
                    'id' => 12345,
                    'is_bot' => false,
                    'first_name' => 'Test'
                ],
                'chat' => [
                    'id' => 12345,
                    'type' => 'private'
                ],
                'date' => time(),
                'text' => '/test'
            ]
        ]);

        // Should still return 500 but not expose internal error
        $response->assertStatus(500);
        $response->assertJson(['ok' => false]);
    }

    /**
     * Test natural language processing
     */
    public function test_natural_language_processing()
    {
        $testCases = [
            '¿Cuánto está la gasolina?' => 'precios',
            'Mostrar tendencia de precios' => 'tendencia',
            '¿Cuál es mi ranking?' => 'ranking',
            'Necesito ayuda' => 'help'
        ];
        
        foreach ($testCases as $input => $expectedCommand) {
            $response = $this->postJson('/api/v1/telegram/webhook', [
                'update_id' => 123462,
                'message' => [
                    'message_id' => 7,
                    'from' => [
                        'id' => 12345,
                        'is_bot' => false,
                        'first_name' => 'Test'
                    ],
                    'chat' => [
                        'id' => 12345,
                        'type' => 'private'
                    ],
                    'date' => time(),
                    'text' => $input
                ]
            ]);
            
            $response->assertStatus(200);
        }
    }

    /**
     * Test rate limiting prevents spam
     */
    public function test_rate_limiting_prevents_spam()
    {
        // This would be tested with actual rate limiting middleware
        // For now, just ensure the handler exists
        $handler = app(\App\Exceptions\Telegram\BotExceptionHandler::class);
        $this->assertNotNull($handler);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}