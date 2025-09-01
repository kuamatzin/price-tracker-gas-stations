<?php

namespace App\Exceptions\Telegram;

use App\Services\Telegram\CommandRegistry;
use App\Services\Telegram\TimeoutManager;
use App\Services\Telegram\TranslationService;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;
use Telegram\Bot\Objects\Update;
use Throwable;

class BotExceptionHandler
{
    protected TranslationService $translator;

    protected CommandRegistry $registry;

    protected TimeoutManager $timeoutManager;

    public function __construct(
        TranslationService $translator,
        CommandRegistry $registry,
        TimeoutManager $timeoutManager
    ) {
        $this->translator = $translator;
        $this->registry = $registry;
        $this->timeoutManager = $timeoutManager;
    }

    /**
     * Handle bot exceptions with enhanced error categorization
     */
    public function handle(Throwable $exception, ?Update $update = null): void
    {
        $correlationId = uniqid('err_');
        $errorCategory = $this->categorizeError($exception);

        // Enhanced logging with correlation ID and categorization
        Log::error('Telegram Bot Error', [
            'correlation_id' => $correlationId,
            'category' => $errorCategory,
            'recoverable' => $this->isRecoverable($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
            'update' => $update ? $update->toArray() : null,
        ]);

        // Try to send user-friendly error message
        if ($update) {
            $chatId = $this->getChatId($update);

            if ($chatId) {
                $this->sendCategorizedErrorMessage($chatId, $exception, $correlationId, $errorCategory);
            }
        }

        // Report to monitoring service (Sentry) with enhanced context
        if (app()->bound('sentry')) {
            \Sentry\configureScope(function (\Sentry\State\Scope $scope) use ($correlationId, $errorCategory) {
                $scope->setTag('error_category', $errorCategory);
                $scope->setTag('correlation_id', $correlationId);
                $scope->setContext('telegram_bot', [
                    'error_category' => $errorCategory,
                    'correlation_id' => $correlationId,
                ]);
            });

            app('sentry')->captureException($exception);
        }
    }

    /**
     * Handle unknown command
     */
    public function handleUnknownCommand(string $command, Update $update): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
            return;
        }

        // Find similar commands
        $suggestions = $this->registry->getSimilar($command);

        $text = '❌ '.$this->translator->get('errors.unknown_command')."\n\n";

        if (! empty($suggestions)) {
            $text .= '*'.$this->translator->get('suggestions.title')."*\n";
            foreach ($suggestions as $suggestion) {
                $text .= "• `/{$suggestion}`\n";
            }
        }

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send error message: '.$e->getMessage());
        }
    }

    /**
     * Handle rate limiting
     */
    public function handleRateLimit(Update $update, int $retryAfter = 60): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
            return;
        }

        $text = '⏱ '.$this->translator->get('errors.rate_limit')."\n";
        $text .= sprintf($this->translator->get('errors.retry_after'), $retryAfter);

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send rate limit message: '.$e->getMessage());
        }
    }

    /**
     * Handle API timeout
     */
    public function handleTimeout(Update $update): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
            return;
        }

        $text = '⏳ '.$this->translator->get('errors.api_timeout');

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send timeout message: '.$e->getMessage());
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
                'text' => '❌ '.$message,
                'parse_mode' => 'Markdown',
            ]);
        } catch (Throwable $e) {
            // If we can't send the error message, just log it
            Log::error('Failed to send error message to user: '.$e->getMessage());
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
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Handle validation errors
     */
    public function handleValidationError(array $errors, Update $update): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
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
                'parse_mode' => 'Markdown',
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send validation error message: '.$e->getMessage());
        }
    }

    /**
     * Categorize error type for better handling
     */
    protected function categorizeError(Throwable $exception): string
    {
        $className = get_class($exception);
        $message = strtolower($exception->getMessage());

        // Network/API errors
        if ($exception instanceof \GuzzleHttp\Exception\ConnectException ||
            $exception instanceof \GuzzleHttp\Exception\RequestException ||
            str_contains($message, 'timeout') ||
            str_contains($message, 'connection')) {
            return 'network';
        }

        // Database errors
        if ($exception instanceof \Illuminate\Database\QueryException ||
            str_contains($message, 'database') ||
            str_contains($message, 'sql')) {
            return 'database';
        }

        // Validation errors
        if ($exception instanceof \Illuminate\Validation\ValidationException ||
            str_contains($message, 'validation')) {
            return 'validation';
        }

        // Rate limiting
        if ($exception instanceof \Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException ||
            str_contains($message, 'rate limit') ||
            str_contains($message, 'too many requests')) {
            return 'rate_limit';
        }

        // Authentication/Authorization
        if (str_contains($message, 'unauthorized') ||
            str_contains($message, 'permission') ||
            str_contains($message, 'forbidden')) {
            return 'auth';
        }

        // Circuit breaker
        if (str_contains($message, 'circuit breaker')) {
            return 'circuit_breaker';
        }

        // Business logic errors
        if (str_contains($message, 'not found') ||
            str_contains($message, 'invalid')) {
            return 'business_logic';
        }

        return 'general';
    }

    /**
     * Check if error is recoverable
     */
    protected function isRecoverable(Throwable $exception): bool
    {
        $category = $this->categorizeError($exception);

        return match ($category) {
            'network', 'timeout', 'rate_limit', 'circuit_breaker' => true,
            'database', 'validation', 'business_logic' => false,
            'auth' => false,
            default => true,
        };
    }

    /**
     * Send categorized error message with recovery suggestions
     */
    protected function sendCategorizedErrorMessage(
        $chatId,
        Throwable $exception,
        string $correlationId,
        string $category
    ): void {
        $errorMessages = config('telegram.error_messages');
        $errorCode = $this->generateErrorCode($category);

        $message = match ($category) {
            'network' => $errorMessages['timeout'],
            'database' => $errorMessages['service_unavailable'],
            'validation' => $errorMessages['invalid_input'],
            'rate_limit' => $errorMessages['rate_limit'],
            'auth' => $errorMessages['unauthorized'],
            'circuit_breaker' => $errorMessages['circuit_open'],
            'business_logic' => $errorMessages['invalid_input'],
            default => $errorMessages['general_error'],
        };

        // Add recovery suggestions based on category
        $recoverySuggestion = $this->getRecoverySuggestion($category);

        $fullMessage = $message;
        if ($recoverySuggestion) {
            $fullMessage .= "\n\n💡 ".$recoverySuggestion;
        }

        // Add error code for support
        $fullMessage .= "\n\n🔍 Código de error: `{$errorCode}`";

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $fullMessage,
                'parse_mode' => 'Markdown',
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send categorized error message: '.$e->getMessage());
        }
    }

    /**
     * Generate user-friendly error code
     */
    protected function generateErrorCode(string $category): string
    {
        $prefix = match ($category) {
            'network' => 'NET',
            'database' => 'DB',
            'validation' => 'VAL',
            'rate_limit' => 'RL',
            'auth' => 'AUTH',
            'circuit_breaker' => 'CB',
            'business_logic' => 'BL',
            default => 'GEN',
        };

        return $prefix.'-'.substr(time(), -6);
    }

    /**
     * Get recovery suggestion based on error category
     */
    protected function getRecoverySuggestion(string $category): ?string
    {
        return match ($category) {
            'network' => 'Verifica tu conexión a internet e intenta de nuevo.',
            'rate_limit' => 'Espera unos minutos antes de enviar más comandos.',
            'validation' => 'Revisa el formato de tu comando. Usa /help para ver ejemplos.',
            'circuit_breaker' => 'El servicio se está recuperando. Intenta de nuevo en unos minutos.',
            'business_logic' => 'Verifica que los datos ingresados sean correctos.',
            default => 'Si el problema persiste, contacta a soporte.',
        };
    }

    /**
     * Handle specific timeout errors
     */
    public function handleSpecificTimeout(string $service, Update $update): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
            return;
        }

        $message = $this->timeoutManager->getTimeoutMessage($service);

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $message,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send timeout message: '.$e->getMessage());
        }
    }

    /**
     * Handle circuit breaker open errors
     */
    public function handleCircuitBreakerOpen(string $service, Update $update): void
    {
        $chatId = $this->getChatId($update);

        if (! $chatId) {
            return;
        }

        $errorMessages = config('telegram.error_messages');
        $message = $errorMessages['circuit_open'];

        try {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => $message,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to send circuit breaker message: '.$e->getMessage());
        }
    }
}
