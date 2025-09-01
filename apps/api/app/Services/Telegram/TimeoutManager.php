<?php

namespace App\Services\Telegram;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\ResponseInterface;

class TimeoutManager
{
    protected array $timeouts;

    protected int $maxRetries = 3;

    protected array $backoffMultipliers = [1, 2, 4]; // Exponential backoff

    public function __construct()
    {
        $this->timeouts = config('telegram.timeouts', [
            'deepseek_api' => 2000,
            'price_query' => 3000,
            'analytics' => 5000,
            'webhook' => 30000,
            'default' => 10000,
        ]);
    }

    /**
     * Execute a function with timeout and retry logic
     */
    public function executeWithTimeout(
        callable $function,
        string $timeoutType = 'default',
        ?int $retries = null
    ) {
        // Input validation
        if (!is_callable($function)) {
            throw new \InvalidArgumentException('First parameter must be callable');
        }

        if ($retries !== null && $retries < 0) {
            throw new \InvalidArgumentException('Retries must be non-negative');
        }

        if (empty($timeoutType) || !is_string($timeoutType)) {
            $timeoutType = 'default';
        }

        $timeout = $this->getTimeout($timeoutType);
        $maxRetries = $retries ?? $this->maxRetries;

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $startTime = microtime(true);

                // Set timeout for the operation
                $result = $this->executeWithTimeLimit($function, $timeout);

                $executionTime = (microtime(true) - $startTime) * 1000;

                Log::info('Operation completed successfully', [
                    'timeout_type' => $timeoutType,
                    'execution_time_ms' => round($executionTime, 2),
                    'attempt' => $attempt,
                    'timeout_limit_ms' => $timeout,
                ]);

                return $result;
            } catch (TimeoutException $e) {
                $this->logTimeoutAttempt($timeoutType, $attempt, $maxRetries, $e);

                if ($attempt === $maxRetries) {
                    throw new TimeoutException(
                        $this->getTimeoutMessage($timeoutType),
                        $e->getCode(),
                        $e
                    );
                }

                // Apply exponential backoff
                $backoffMs = $this->getBackoffDelay($attempt);
                usleep($backoffMs * 1000);
            } catch (\Exception $e) {
                $this->logGeneralError($timeoutType, $attempt, $e);

                if ($attempt === $maxRetries) {
                    throw $e;
                }

                // Apply exponential backoff for other errors too
                $backoffMs = $this->getBackoffDelay($attempt);
                usleep($backoffMs * 1000);
            }
        }
    }

    /**
     * Execute function with time limit
     */
    protected function executeWithTimeLimit(callable $function, int $timeoutMs)
    {
        $startTime = microtime(true);

        // For PHP, we'll use a different approach since we can't truly timeout arbitrary functions
        // We'll rely on HTTP client timeouts and database query timeouts configured elsewhere

        $result = $function();

        $executionTime = (microtime(true) - $startTime) * 1000;

        if ($executionTime > $timeoutMs) {
            throw new TimeoutException(
                "Operation exceeded timeout limit of {$timeoutMs}ms (took {$executionTime}ms)"
            );
        }

        return $result;
    }

    /**
     * Create HTTP client with specific timeout
     */
    public function createHttpClient(string $timeoutType = 'default'): Client
    {
        $timeoutSeconds = $this->getTimeout($timeoutType) / 1000;

        return new Client([
            'timeout' => $timeoutSeconds,
            'connect_timeout' => min($timeoutSeconds, 5.0), // Max 5 seconds for connection
            'read_timeout' => $timeoutSeconds,
            'verify' => true,
            'http_errors' => true,
        ]);
    }

    /**
     * Execute HTTP request with timeout and retry
     */
    public function executeHttpRequest(
        string $method,
        string $url,
        array $options = [],
        string $timeoutType = 'default'
    ): ResponseInterface {
        $client = $this->createHttpClient($timeoutType);

        return $this->executeWithTimeout(
            function () use ($client, $method, $url, $options) {
                return $client->request($method, $url, $options);
            },
            $timeoutType
        );
    }

    /**
     * Get timeout value for specific type
     */
    public function getTimeout(string $type): int
    {
        return $this->timeouts[$type] ?? $this->timeouts['default'];
    }

    /**
     * Get all configured timeouts
     */
    public function getAllTimeouts(): array
    {
        return $this->timeouts;
    }

    /**
     * Get backoff delay for retry attempt
     */
    protected function getBackoffDelay(int $attempt): int
    {
        $baseDelay = 100; // 100ms base delay
        $multiplier = $this->backoffMultipliers[min($attempt - 1, count($this->backoffMultipliers) - 1)];

        return $baseDelay * $multiplier;
    }

    /**
     * Get timeout error message in Spanish
     */
    public function getTimeoutMessage(string $timeoutType): string
    {
        $messages = config('telegram.error_messages');

        return match ($timeoutType) {
            'deepseek_api' => $messages['timeout'] ?? '⏱️ El análisis tardó demasiado. Intenta de nuevo.',
            'price_query' => $messages['timeout'] ?? '⏱️ La consulta de precios tardó demasiado. Intenta de nuevo.',
            'analytics' => $messages['timeout'] ?? '⏱️ El análisis tardó demasiado. Intenta de nuevo.',
            'webhook' => $messages['timeout'] ?? '⏱️ La operación tardó demasiado. Intenta de nuevo.',
            default => $messages['timeout'] ?? '⏱️ La operación tardó demasiado. Por favor, intenta de nuevo en unos momentos.',
        };
    }

    /**
     * Log timeout attempt
     */
    protected function logTimeoutAttempt(string $timeoutType, int $attempt, int $maxRetries, \Exception $e): void
    {
        Log::warning('Operation timeout', [
            'timeout_type' => $timeoutType,
            'attempt' => $attempt,
            'max_retries' => $maxRetries,
            'timeout_limit_ms' => $this->getTimeout($timeoutType),
            'error' => $e->getMessage(),
        ]);
    }

    /**
     * Log general error
     */
    protected function logGeneralError(string $timeoutType, int $attempt, \Exception $e): void
    {
        Log::error('Operation failed', [
            'timeout_type' => $timeoutType,
            'attempt' => $attempt,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
    }

    /**
     * Get timeout statistics
     */
    public function getTimeoutStats(): array
    {
        return [
            'configured_timeouts' => $this->timeouts,
            'max_retries' => $this->maxRetries,
            'backoff_multipliers' => $this->backoffMultipliers,
        ];
    }
}

class TimeoutException extends \Exception
{
    //
}
