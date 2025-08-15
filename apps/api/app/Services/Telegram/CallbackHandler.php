<?php

namespace App\Services\Telegram;

use Telegram\Bot\Objects\Update;
use Telegram\Bot\Laravel\Facades\Telegram;
use App\Telegram\Commands\ComandosCommand;
use Illuminate\Support\Facades\Log;

class CallbackHandler
{
    protected CommandRegistry $registry;
    protected CommandParser $parser;

    public function __construct(CommandRegistry $registry, CommandParser $parser)
    {
        $this->registry = $registry;
        $this->parser = $parser;
    }

    /**
     * Handle callback query from inline keyboard
     */
    public function handle(Update $update, TelegramSession $session): void
    {
        $callbackQuery = $update->getCallbackQuery();
        
        if (!$callbackQuery) {
            return;
        }

        $data = $callbackQuery->getData();
        $chatId = $callbackQuery->getMessage()->getChat()->getId();
        $messageId = $callbackQuery->getMessage()->getMessageId();
        
        // Answer callback query to remove loading state
        try {
            Telegram::answerCallbackQuery([
                'callback_query_id' => $callbackQuery->getId()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to answer callback query: ' . $e->getMessage());
        }

        // Parse callback data
        $parsed = $this->parser->parseCallback($data);
        $action = $parsed['action'];
        $params = $parsed['params'];

        // Route based on action
        switch ($action) {
            case 'menu':
                $this->handleMenuCallback($params[0] ?? 'main', $chatId, $messageId);
                break;
                
            case 'cmd':
                $this->handleCommandCallback($params[0] ?? '', $chatId, $messageId, $update);
                break;
                
            case 'register':
                $this->handleRegistrationCallback($params[0] ?? '', $chatId, $messageId, $session);
                break;
                
            case 'config':
                $this->handleConfigCallback($params, $chatId, $messageId, $session);
                break;
                
            default:
                Log::warning("Unknown callback action: {$action}");
        }
    }

    /**
     * Handle menu navigation callbacks
     */
    protected function handleMenuCallback(string $menu, $chatId, $messageId): void
    {
        switch ($menu) {
            case 'main':
                $this->showMainMenu($chatId, $messageId);
                break;
                
            case 'precios':
                ComandosCommand::showPriceMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;
                
            case 'analisis':
                ComandosCommand::showAnalysisMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;
                
            case 'configuracion':
                ComandosCommand::showConfigMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;
                
            case 'ayuda':
                ComandosCommand::showHelpMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;
                
            default:
                Log::warning("Unknown menu: {$menu}");
        }
    }

    /**
     * Handle command execution callbacks
     */
    protected function handleCommandCallback(string $command, $chatId, $messageId, Update $update): void
    {
        // Delete the menu message
        try {
            Telegram::deleteMessage([
                'chat_id' => $chatId,
                'message_id' => $messageId
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to delete message: ' . $e->getMessage());
        }

        // Execute the command
        if ($this->registry->has($command)) {
            $commandClass = $this->registry->get($command);
            
            try {
                $commandInstance = new $commandClass();
                
                if (method_exists($commandInstance, 'setUpdate')) {
                    $commandInstance->setUpdate($update);
                }
                
                $commandInstance->handle();
            } catch (\Exception $e) {
                Log::error("Command execution error for /{$command}: " . $e->getMessage());
                
                Telegram::sendMessage([
                    'chat_id' => $chatId,
                    'text' => "❌ Error al ejecutar el comando. Por favor, intenta de nuevo."
                ]);
            }
        } else {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => "❌ Comando no disponible: /{$command}"
            ]);
        }
    }

    /**
     * Handle registration callbacks
     */
    protected function handleRegistrationCallback(string $type, $chatId, $messageId, TelegramSession $session): void
    {
        switch ($type) {
            case 'existing':
                // Start registration flow for existing account
                $session->setState('registration:email');
                $session->setStateData(['type' => 'existing']);
                
                Telegram::editMessageText([
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => "📧 *Conectar cuenta existente*\n\n" .
                             "Por favor, ingresa el correo electrónico asociado a tu cuenta de FuelIntel:",
                    'parse_mode' => 'Markdown'
                ]);
                break;
                
            case 'new':
                // Start registration flow for new account
                $session->setState('registration:email');
                $session->setStateData(['type' => 'new']);
                
                Telegram::editMessageText([
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => "📝 *Crear cuenta nueva*\n\n" .
                             "Por favor, ingresa tu correo electrónico para crear una nueva cuenta:",
                    'parse_mode' => 'Markdown'
                ]);
                break;
                
            default:
                Log::warning("Unknown registration type: {$type}");
        }
    }

    /**
     * Handle configuration callbacks
     */
    protected function handleConfigCallback(array $params, $chatId, $messageId, TelegramSession $session): void
    {
        $setting = $params[0] ?? '';
        $value = $params[1] ?? '';
        
        switch ($setting) {
            case 'language':
                $session->setLanguage($value);
                
                $langName = $value === 'es' ? 'Español' : 'English';
                
                Telegram::answerCallbackQuery([
                    'callback_query_id' => $messageId,
                    'text' => "✅ Idioma cambiado a {$langName}"
                ]);
                break;
                
            case 'notifications':
                $enabled = $value === 'on';
                $session->put('notifications_enabled', $enabled);
                
                $status = $enabled ? 'activadas' : 'desactivadas';
                
                Telegram::answerCallbackQuery([
                    'callback_query_id' => $messageId,
                    'text' => "✅ Notificaciones {$status}"
                ]);
                break;
                
            default:
                Log::warning("Unknown config setting: {$setting}");
        }
    }

    /**
     * Show main menu
     */
    protected function showMainMenu($chatId, $messageId): void
    {
        $keyboard = \Telegram\Bot\Keyboard\Keyboard::make()
            ->inline()
            ->row([
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '💰 Precios',
                    'callback_data' => 'menu:precios'
                ]),
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '📊 Análisis',
                    'callback_data' => 'menu:analisis'
                ])
            ])
            ->row([
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '⚙️ Configuración',
                    'callback_data' => 'menu:configuracion'
                ]),
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '❓ Ayuda',
                    'callback_data' => 'menu:ayuda'
                ])
            ]);
        
        $text = "*📋 Menú Principal*\n\n";
        $text .= "Selecciona una categoría:";
        
        Telegram::editMessageText([
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $text,
            'parse_mode' => 'Markdown',
            'reply_markup' => $keyboard
        ]);
    }
}