<?php

namespace App\Exceptions\Telegram;

use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;
use Telegram\Bot\Objects\Update;
use App\Services\Telegram\TranslationService;
use App\Services\Telegram\CommandRegistry;
use Throwable;

class BotExceptionHandler
{
    protected TranslationService $translator;
    protected CommandRegistry $registry;

    public function __construct(TranslationService $translator, CommandRegistry $registry)
    {
        $this->translator = $translator;
        $this->registry = $registry;
    }

    /**
     * Handle bot exceptions
     */
    public function handle(Throwable $exception, ?Update $update = null): void
    {
        // Log the error
        Log::error('Telegram Bot Error', [
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
            'update' => $update ? $update->toArray() : null
        ]);

        // Try to send user-friendly error message
        if ($update) {
            $chatId = $this->getChatId($update);
            
            if ($chatId) {
                $this->sendErrorMessage($chatId, $exception);
            }
        }

        // Report to monitoring service (Sentry)
        if (app()->bound('sentry')) {
            app('sentry')->captureException($exception);
        }
    }

    /**
     * Handle unknown command
     */
    public function handleUnknownCommand(string $command, Update $update): void
    {
        $chatId = $this->getChatId($update);
        
        if (!$chatId) {
            return;
        }

        // Find similar commands
        $suggestions = $this->registry->getSimilar($command);
        
        $text = "❌ " . $this->translator->get('errors.unknown_command') . "\n\n";
        
        if (!empty($suggestions)) {
            $text .= "*" . $this->translator->get('suggestions.title') . "*\n";
            foreach ($suggestions as $suggestion) {
                $text .= "• `/{$suggestion}`\n";
            }
        }
        
        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown'
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send error message: ' . $e->getMessage());
        }
    }

    /**
     * Handle rate limiting
     */
    public function handleRateLimit(Update $update, int $retryAfter = 60): void
    {
        $chatId = $this->getChatId($update);
        
        if (!$chatId) {
            return;
        }

        $text = "⏱ " . $this->translator->get('errors.rate_limit') . "\n";
        $text .= sprintf($this->translator->get('errors.retry_after'), $retryAfter);
        
        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send rate limit message: ' . $e->getMessage());
        }
    }

    /**
     * Handle API timeout
     */
    public function handleTimeout(Update $update): void
    {
        $chatId = $this->getChatId($update);
        
        if (!$chatId) {
            return;
        }

        $text = "⏳ " . $this->translator->get('errors.api_timeout');
        
        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send timeout message: ' . $e->getMessage());
        }
    }

    /**
     * Send error message to user
     */
    protected function sendErrorMessage($chatId, Throwable $exception): void
    {
        $message = $this->getUserFriendlyMessage($exception);
        
        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => "❌ " . $message,
                'parse_mode' => 'Markdown'
            ]);
        } catch (Throwable $e) {
            // If we can't send the error message, just log it
            Log::error('Failed to send error message to user: ' . $e->getMessage());
        }
    }

    /**
     * Get user-friendly error message
     */
    protected function getUserFriendlyMessage(Throwable $exception): string
    {
        // Check for specific exception types
        if ($exception instanceof \Illuminate\Database\QueryException) {
            return $this->translator->get('errors.database');
        }
        
        if ($exception instanceof \Illuminate\Validation\ValidationException) {
            return $this->translator->get('errors.validation');
        }
        
        if ($exception instanceof \Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException) {
            return $this->translator->get('errors.rate_limit');
        }
        
        if ($exception instanceof \GuzzleHttp\Exception\ConnectException) {
            return $this->translator->get('errors.api_timeout');
        }
        
        // Check for specific error messages
        $message = strtolower($exception->getMessage());
        
        if (str_contains($message, 'timeout')) {
            return $this->translator->get('errors.api_timeout');
        }
        
        if (str_contains($message, 'permission') || str_contains($message, 'unauthorized')) {
            return $this->translator->get('errors.no_permission');
        }
        
        if (str_contains($message, 'not found')) {
            return $this->translator->get('errors.not_found');
        }
        
        // Default error message
        return $this->translator->get('errors.general');
    }

    /**
     * Get chat ID from update
     */
    protected function getChatId(Update $update): ?int
    {
        if ($update->getMessage()) {
            return $update->getMessage()->getChat()->getId();
        }
        
        if ($update->getCallbackQuery()) {
            return $update->getCallbackQuery()->getMessage()->getChat()->getId();
        }
        
        if ($update->getEditedMessage()) {
            return $update->getEditedMessage()->getChat()->getId();
        }
        
        return null;
    }

    /**
     * Log command execution
     */
    public function logCommandExecution(string $command, Update $update, float $executionTime): void
    {
        $userId = null;
        $username = null;
        
        if ($update->getMessage()) {
            $from = $update->getMessage()->getFrom();
            $userId = $from->getId();
            $username = $from->getUsername();
        }
        
        Log::info('Telegram command executed', [
            'command' => $command,
            'user_id' => $userId,
            'username' => $username,
            'execution_time' => $executionTime,
            'timestamp' => now()->toIso8601String()
        ]);
    }

    /**
     * Handle validation errors
     */
    public function handleValidationError(array $errors, Update $update): void
    {
        $chatId = $this->getChatId($update);
        
        if (!$chatId) {
            return;
        }

        $text = "❌ *Errores de validación:*\n\n";
        
        foreach ($errors as $field => $messages) {
            foreach ($messages as $message) {
                $text .= "• {$message}\n";
            }
        }
        
        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown'
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send validation error message: ' . $e->getMessage());
        }
    }
}