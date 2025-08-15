<?php

namespace App\Telegram\Commands;

use Telegram\Bot\Keyboard\Keyboard;
use App\Models\TelegramUser;
use App\Services\Telegram\SessionManager;

class StartCommand extends BaseCommand
{
    /**
     * @var string Command Name
     */
    protected $name = 'start';

    /**
     * @var string Command Description
     */
    protected $description = 'Iniciar el bot y registrarse';

    /**
     * Execute the command
     */
    public function handle(): void
    {
        $message = $this->getUpdate()->getMessage();
        $telegramUserId = $this->getUserId();
        $chatId = $this->getChatId();
        
        $this->sendTypingAction($chatId);
        
        // Get or create Telegram user
        $telegramUser = TelegramUser::firstOrCreate(
            ['telegram_id' => $telegramUserId],
            [
                'telegram_username' => $message->getFrom()->getUsername(),
                'first_name' => $message->getFrom()->getFirstName(),
                'last_name' => $message->getFrom()->getLastName(),
                'language_code' => $message->getFrom()->getLanguageCode() ?? 'es',
                'is_bot' => $message->getFrom()->getIsBot() ?? false,
            ]
        );
        
        // Update last interaction
        $telegramUser->touchInteraction();
        
        if ($telegramUser->isRegistered()) {
            $this->sendWelcomeBack($chatId, $telegramUser);
        } else {
            $this->startRegistration($chatId, $telegramUser);
        }
    }

    /**
     * Start registration flow for new users
     */
    protected function startRegistration($chatId, TelegramUser $telegramUser): void
    {
        // Generate registration token
        $token = $telegramUser->generateRegistrationToken();
        
        // Store in session
        $session = $this->sessionManager->getSession($telegramUser->telegram_id);
        $session->put('registration_token', $token);
        $session->put('registration_step', 'choose_type');
        $this->sessionManager->saveSession($session);
        
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '🔗 Conectar cuenta existente',
                    'callback_data' => 'register:existing'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '📝 Crear cuenta nueva',
                    'callback_data' => 'register:new'
                ])
            ]);
        
        $text = "¡Bienvenido a FuelIntel Bot! 🚀\n\n";
        $text .= "Te ayudaré a monitorear precios de combustible y tomar decisiones inteligentes para tu estación de servicio.\n\n";
        $text .= "Para comenzar, necesito vincular tu cuenta de Telegram con FuelIntel.\n\n";
        $text .= "¿Cómo deseas continuar?";
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => $text,
            'reply_markup' => $keyboard,
            'parse_mode' => 'Markdown'
        ]);
    }

    /**
     * Welcome back existing users
     */
    protected function sendWelcomeBack($chatId, TelegramUser $telegramUser): void
    {
        $user = $telegramUser->user;
        $name = $telegramUser->getDisplayName();
        
        $text = "¡Hola de nuevo, {$name}! 👋\n\n";
        $text .= "¿Qué deseas hacer hoy?\n\n";
        $text .= "Puedes usar los botones de abajo o escribir directamente lo que necesitas.";
        
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '💰 Ver precios',
                    'callback_data' => 'menu:precios'
                ]),
                Keyboard::inlineButton([
                    'text' => '📊 Análisis',
                    'callback_data' => 'menu:analisis'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⚙️ Configuración',
                    'callback_data' => 'menu:configuracion'
                ]),
                Keyboard::inlineButton([
                    'text' => '❓ Ayuda',
                    'callback_data' => 'cmd:help'
                ])
            ]);
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => $text,
            'reply_markup' => $keyboard,
            'parse_mode' => 'Markdown'
        ]);
    }
}