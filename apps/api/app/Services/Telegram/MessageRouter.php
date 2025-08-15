<?php

namespace App\Services\Telegram;

use Telegram\Bot\Objects\Update;
use Telegram\Bot\Laravel\Facades\Telegram;
use App\Telegram\Commands\ComandosCommand;
use Illuminate\Support\Facades\Log;

class MessageRouter
{
    protected CommandRegistry $registry;
    protected CommandParser $parser;
    protected CallbackHandler $callbackHandler;

    public function __construct(
        CommandRegistry $registry,
        CommandParser $parser,
        CallbackHandler $callbackHandler
    ) {
        $this->registry = $registry;
        $this->parser = $parser;
        $this->callbackHandler = $callbackHandler;
    }

    /**
     * Route an incoming update to the appropriate handler
     */
    public function route(Update $update, TelegramSession $session): void
    {
        try {
            // Handle callback queries (button clicks)
            if ($update->getCallbackQuery()) {
                $this->handleCallbackQuery($update, $session);
                return;
            }

            // Handle regular messages
            $message = $update->getMessage();
            if (!$message) {
                return;
            }

            $text = $message->getText();
            if (!$text) {
                // Handle non-text messages (photos, documents, etc.)
                $this->handleNonTextMessage($update, $session);
                return;
            }

            // Check if user is in a conversation flow
            if ($session->isInConversation()) {
                $this->handleConversationFlow($update, $session);
                return;
            }

            // Parse the message
            $parsed = $this->parser->parse($text);

            if ($parsed['is_command']) {
                $this->handleCommand($parsed['command'], $parsed['arguments'], $update, $session);
            } elseif ($this->parser->isNaturalQuery($text)) {
                $this->handleNaturalLanguage($text, $update, $session);
            } else {
                $this->handleUnknownInput($text, $update, $session);
            }
        } catch (\Exception $e) {
            Log::error('Message routing error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            $this->sendErrorMessage($update);
        }
    }

    /**
     * Handle command messages
     */
    protected function handleCommand(string $command, ?string $arguments, Update $update, TelegramSession $session): void
    {
        // Resolve aliases
        $command = $this->registry->resolveAlias($command);

        // Check if command exists
        if (!$this->registry->has($command)) {
            $this->handleUnknownCommand($command, $update);
            return;
        }

        // Get command class
        $commandClass = $this->registry->get($command);

        // Execute command
        try {
            $commandInstance = new $commandClass();
            
            // Set up command context
            if (method_exists($commandInstance, 'setUpdate')) {
                $commandInstance->setUpdate($update);
            }
            
            if (method_exists($commandInstance, 'setArguments') && $arguments) {
                $commandInstance->setArguments($arguments);
            }

            // Execute
            $commandInstance->handle();
        } catch (\Exception $e) {
            Log::error("Command execution error for /{$command}: " . $e->getMessage());
            $this->sendErrorMessage($update);
        }
    }

    /**
     * Handle callback queries (button clicks)
     */
    protected function handleCallbackQuery(Update $update, TelegramSession $session): void
    {
        $this->callbackHandler->handle($update, $session);
    }

    /**
     * Handle conversation flows
     */
    protected function handleConversationFlow(Update $update, TelegramSession $session): void
    {
        $state = $session->getState();
        
        // Route based on current state
        switch ($state) {
            case 'registration:email':
                $this->handleRegistrationEmail($update, $session);
                break;
            
            case 'registration:station':
                $this->handleRegistrationStation($update, $session);
                break;
            
            case 'configuration:station_search':
                $this->handleStationSearch($update, $session);
                break;
            
            default:
                // Unknown state, clear it
                $session->clearState();
                $this->handleUnknownInput($update->getMessage()->getText(), $update, $session);
        }
    }

    /**
     * Handle natural language queries
     */
    protected function handleNaturalLanguage(string $text, Update $update, TelegramSession $session): void
    {
        $chatId = $update->getMessage()->getChat()->getId();
        
        // Extract intent from natural language
        $text = strtolower($text);
        
        // Price queries
        if (str_contains($text, 'precio') || str_contains($text, 'cuánto') || str_contains($text, 'cuesta')) {
            if (str_contains($text, 'competencia') || str_contains($text, 'competidor')) {
                $this->handleCommand('precios_competencia', null, $update, $session);
            } elseif (str_contains($text, 'promedio') || str_contains($text, 'municipio')) {
                $this->handleCommand('precio_promedio', null, $update, $session);
            } else {
                $fuelType = $this->parser->extractFuelType($text);
                $this->handleCommand('precios', $fuelType, $update, $session);
            }
            return;
        }
        
        // Trend queries
        if (str_contains($text, 'tendencia') || str_contains($text, 'histórico')) {
            $days = $this->parser->extractTimePeriod($text) ?? 7;
            $this->handleCommand('tendencia', (string)$days, $update, $session);
            return;
        }
        
        // Ranking queries
        if (str_contains($text, 'ranking') || str_contains($text, 'posición')) {
            $this->handleCommand('ranking', null, $update, $session);
            return;
        }
        
        // Configuration queries
        if (str_contains($text, 'configurar') || str_contains($text, 'ajustes')) {
            $this->handleCommand('configurar', null, $update, $session);
            return;
        }
        
        // Help queries
        if (str_contains($text, 'ayuda') || str_contains($text, 'help')) {
            $this->handleCommand('help', null, $update, $session);
            return;
        }
        
        // If no match, show suggestions
        $this->handleUnknownInput($text, $update, $session);
    }

    /**
     * Handle unknown commands
     */
    protected function handleUnknownCommand(string $command, Update $update): void
    {
        $unknownCommand = new \App\Telegram\Commands\UnknownCommand();
        $unknownCommand->setUpdate($update);
        $unknownCommand->handle();
    }

    /**
     * Handle unknown input
     */
    protected function handleUnknownInput(string $text, Update $update, TelegramSession $session): void
    {
        $chatId = $update->getMessage()->getChat()->getId();
        
        $response = "No entendí tu mensaje: \"{$text}\"\n\n";
        $response .= "Puedes:\n";
        $response .= "• Usar comandos (ej: /precios)\n";
        $response .= "• Escribir naturalmente (ej: \"¿Cuánto está la gasolina?\")\n";
        $response .= "• Ver el menú con /comandos\n";
        $response .= "• Obtener ayuda con /help";
        
        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    /**
     * Handle non-text messages
     */
    protected function handleNonTextMessage(Update $update, TelegramSession $session): void
    {
        $chatId = $update->getMessage()->getChat()->getId();
        
        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => "Lo siento, solo puedo procesar mensajes de texto por el momento.\n\nUsa /help para ver los comandos disponibles."
        ]);
    }

    /**
     * Send error message
     */
    protected function sendErrorMessage(Update $update): void
    {
        $chatId = null;
        
        if ($update->getMessage()) {
            $chatId = $update->getMessage()->getChat()->getId();
        } elseif ($update->getCallbackQuery()) {
            $chatId = $update->getCallbackQuery()->getMessage()->getChat()->getId();
        }
        
        if ($chatId) {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => "❌ Ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a soporte con /help."
            ]);
        }
    }

    /**
     * Handle registration email step
     */
    protected function handleRegistrationEmail(Update $update, TelegramSession $session): void
    {
        // This would be implemented in a future story for registration flow
        $chatId = $update->getMessage()->getChat()->getId();
        $email = $update->getMessage()->getText();
        
        // Validate email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => "Por favor, ingresa un correo electrónico válido."
            ]);
            return;
        }
        
        // Store email and move to next step
        $session->addStateData('email', $email);
        $session->setState('registration:station');
        
        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => "Excelente! Ahora ingresa el número de tu estación de servicio (ej: E12345):"
        ]);
    }

    /**
     * Handle registration station step
     */
    protected function handleRegistrationStation(Update $update, TelegramSession $session): void
    {
        // This would be implemented in a future story for registration flow
        $chatId = $update->getMessage()->getChat()->getId();
        $stationNumber = $update->getMessage()->getText();
        
        // Here we would validate and complete registration
        // For now, just clear the state
        $session->clearState();
        
        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => "¡Registro completado! Tu estación {$stationNumber} ha sido vinculada.\n\nUsa /help para ver los comandos disponibles."
        ]);
    }

    /**
     * Handle station search
     */
    protected function handleStationSearch(Update $update, TelegramSession $session): void
    {
        // This would be implemented in a future story
        $chatId = $update->getMessage()->getChat()->getId();
        $searchTerm = $update->getMessage()->getText();
        
        $session->clearState();
        
        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => "Buscando estaciones que coincidan con: {$searchTerm}..."
        ]);
    }
}