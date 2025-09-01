<?php

namespace App\Services\Telegram;

use App\Jobs\LogNlpQuery;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;
use Telegram\Bot\Objects\Update;

class MessageRouter
{
    protected CommandRegistry $registry;

    protected CommandParser $parser;

    protected CallbackHandler $callbackHandler;

    protected NlpProcessor $nlpProcessor;

    public function __construct(
        CommandRegistry $registry,
        CommandParser $parser,
        CallbackHandler $callbackHandler,
        NlpProcessor $nlpProcessor
    ) {
        $this->registry = $registry;
        $this->parser = $parser;
        $this->callbackHandler = $callbackHandler;
        $this->nlpProcessor = $nlpProcessor;
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
            if (! $message) {
                return;
            }

            $text = $message->getText();
            if (! $text) {
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
            Log::error('Message routing error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
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
        if (! $this->registry->has($command)) {
            $this->handleUnknownCommand($command, $update);

            return;
        }

        // Get command class
        $commandClass = $this->registry->get($command);

        // Execute command
        try {
            $commandInstance = new $commandClass;

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
            Log::error("Command execution error for /{$command}: ".$e->getMessage());
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
        $userId = $update->getMessage()->getFrom()->getId();

        // Clear expired context
        $session->clearExpiredContext();

        // Get conversation context
        $context = [];
        if (! $session->isContextExpired()) {
            $context = $session->getConversationContext();

            // Check if this is a follow-up query
            if ($this->nlpProcessor->isFollowUpQuery($text)) {
                $context['is_follow_up'] = true;
            }
        }

        // Process with NLP
        $startTime = microtime(true);
        $result = $this->nlpProcessor->process($text, $context);
        $responseTime = (int) ((microtime(true) - $startTime) * 1000);

        // Update session context
        $session->mergeConversationContext([
            'intent' => $result['intent'],
            'entities' => $result['entities'],
            'confidence' => $result['confidence'],
        ]);

        // Log the query asynchronously
        dispatch(new LogNlpQuery([
            'user_id' => $userId,
            'chat_id' => $chatId,
            'original_query' => $result['original_query'],
            'normalized_query' => $result['normalized_query'],
            'interpreted_intent' => $result['intent'],
            'extracted_entities' => $result['entities'],
            'confidence' => $result['confidence'],
            'response_time_ms' => $result['response_time_ms'] ?? $responseTime,
            'used_deepseek' => $result['used_deepseek'],
            'suggested_command' => $result['suggested_command'],
        ]));

        // Route based on confidence
        $confidenceThreshold = config('deepseek.confidence_threshold', 0.7);

        if ($result['confidence'] >= $confidenceThreshold) {
            // Execute interpreted command
            $this->executeInterpretedCommand($result, $update, $session);
        } else {
            // Show fallback suggestions
            $this->showFallbackSuggestions($result, $update, $session);
        }
    }

    /**
     * Execute command based on NLP interpretation
     */
    protected function executeInterpretedCommand(array $nlpResult, Update $update, TelegramSession $session): void
    {
        $intent = $nlpResult['intent'];
        $entities = $nlpResult['entities'];

        switch ($intent) {
            case 'price_query':
                $fuelType = $entities['fuel_type'] ?? null;
                $this->handleCommand('precios', $fuelType, $update, $session);
                break;

            case 'station_search':
                $location = $entities['location'] ?? null;
                $stationName = $entities['station_name'] ?? null;

                if ($stationName) {
                    $this->handleCommand('buscar', $stationName, $update, $session);
                } else {
                    $this->handleCommand('cercanas', $location, $update, $session);
                }
                break;

            case 'help':
                $this->handleCommand('help', null, $update, $session);
                break;

            default:
                $this->showFallbackSuggestions($nlpResult, $update, $session);
        }
    }

    /**
     * Show fallback suggestions when confidence is low
     */
    protected function showFallbackSuggestions(array $nlpResult, Update $update, TelegramSession $session): void
    {
        $chatId = $update->getMessage()->getChat()->getId();
        $suggestedCommand = $nlpResult['suggested_command'];

        $message = "No estoy seguro de entender tu consulta.\n\n";

        if ($suggestedCommand) {
            $message .= "¿Querías decir: `{$suggestedCommand}`?\n\n";

            // Create inline keyboard with suggestion
            $keyboard = [
                [
                    ['text' => '✅ Sí', 'callback_data' => 'execute:'.base64_encode($suggestedCommand)],
                    ['text' => '❌ No', 'callback_data' => 'cancel'],
                ],
            ];

            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $message.'Puedes hacer clic en el botón o escribir /comandos para ver todas las opciones.',
                'parse_mode' => 'Markdown',
                'reply_markup' => json_encode([
                    'inline_keyboard' => $keyboard,
                ]),
            ]);
        } else {
            $message .= "Comandos sugeridos:\n";
            $message .= "• `/precios` - Ver precios actuales\n";
            $message .= "• `/cercanas` - Buscar estaciones cercanas\n";
            $message .= "• `/help` - Obtener ayuda\n";
            $message .= "• `/comandos` - Ver todos los comandos\n";

            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);
        }
    }

    /**
     * Handle unknown commands
     */
    protected function handleUnknownCommand(string $command, Update $update): void
    {
        $unknownCommand = new \App\Telegram\Commands\UnknownCommand;
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
        $response .= '• Obtener ayuda con /help';

        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => $response,
            'parse_mode' => 'Markdown',
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
            'text' => "Lo siento, solo puedo procesar mensajes de texto por el momento.\n\nUsa /help para ver los comandos disponibles.",
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
                'text' => '❌ Ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a soporte con /help.',
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
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => 'Por favor, ingresa un correo electrónico válido.',
            ]);

            return;
        }

        // Store email and move to next step
        $session->addStateData('email', $email);
        $session->setState('registration:station');

        Telegram::sendMessage([
            'chat_id' => $chatId,
            'text' => 'Excelente! Ahora ingresa el número de tu estación de servicio (ej: E12345):',
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
            'text' => "¡Registro completado! Tu estación {$stationNumber} ha sido vinculada.\n\nUsa /help para ver los comandos disponibles.",
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
            'text' => "Buscando estaciones que coincidan con: {$searchTerm}...",
        ]);
    }
}
