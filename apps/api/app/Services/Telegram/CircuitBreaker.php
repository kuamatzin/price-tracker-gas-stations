<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

enum CircuitBreakerState: string
{
    case CLOSED = 'CLOSED';
    case OPEN = 'OPEN';
    case HALF_OPEN = 'HALF_OPEN';
}

class CircuitBreaker
{
    protected string $name;

    protected CircuitBreakerState $state = CircuitBreakerState::CLOSED;

    protected int $failures = 0;

    protected int $successes = 0;

    protected int $lastFailureTime = 0;

    protected int $failureThreshold;

    protected int $cooldownPeriod;

    protected int $successThreshold;

    public function __construct(
        string $name,
        int $failureThreshold = 5,
        int $cooldownPeriod = 60000,
        int $successThreshold = 3
    ) {
        $this->name = $name;
        $this->failureThreshold = $failureThreshold;
        $this->cooldownPeriod = $cooldownPeriod;
        $this->successThreshold = $successThreshold;

        $this->loadState();
    }

    public function execute(callable $function)
    {
        if ($this->state === CircuitBreakerState::OPEN) {
            if ((time() * 1000) - $this->lastFailureTime < $this->cooldownPeriod) {
                throw new \Exception("Circuit breaker {$this->name} is OPEN. Will retry after cooldown period.");
            }
            $this->state = CircuitBreakerState::HALF_OPEN;
            $this->saveState();
            Log::info("Circuit breaker {$this->name} entering HALF_OPEN state");
        }

        try {
            $result = $function();
            $this->onSuccess();

            return $result;
        } catch (\Exception $error) {
            $this->onFailure();
            throw $error;
        }
    }

    protected function onSuccess(): void
    {
        $this->failures = 0;

        if ($this->state === CircuitBreakerState::HALF_OPEN) {
            $this->successes++;
            if ($this->successes >= $this->successThreshold) {
                $this->state = CircuitBreakerState::CLOSED;
                $this->successes = 0;
                Log::info("Circuit breaker {$this->name} is now CLOSED");
            }
        }

        $this->saveState();
    }

    protected function onFailure(): void
    {
        $this->failures++;
        $this->lastFailureTime = time() * 1000;
        $this->successes = 0;

        if ($this->failures >= $this->failureThreshold) {
            $this->state = CircuitBreakerState::OPEN;
            Log::error("Circuit breaker {$this->name} is now OPEN after {$this->failures} consecutive failures");

            // Send to monitoring
            if (function_exists('app') && app()->bound('sentry')) {
                \Sentry\captureMessage("Circuit breaker opened: {$this->name}", \Sentry\Severity::error());
            }
        }

        $this->saveState();
    }

    public function getState(): CircuitBreakerState
    {
        if ($this->state === CircuitBreakerState::OPEN &&
            (time() * 1000) - $this->lastFailureTime >= $this->cooldownPeriod) {
            return CircuitBreakerState::HALF_OPEN;
        }

        return $this->state;
    }

    public function getStats(): array
    {
        return [
            'name' => $this->name,
            'state' => $this->getState()->value,
            'failures' => $this->failures,
            'successes' => $this->successes,
            'lastFailureTime' => $this->lastFailureTime,
            'canAttempt' => $this->canAttempt(),
            'failureThreshold' => $this->failureThreshold,
            'cooldownPeriod' => $this->cooldownPeriod,
            'successThreshold' => $this->successThreshold,
        ];
    }

    public function canAttempt(): bool
    {
        $currentState = $this->getState();

        return $currentState === CircuitBreakerState::CLOSED ||
               $currentState === CircuitBreakerState::HALF_OPEN;
    }

    public function reset(): void
    {
        $this->state = CircuitBreakerState::CLOSED;
        $this->failures = 0;
        $this->successes = 0;
        $this->lastFailureTime = 0;
        $this->saveState();
        Log::info("Circuit breaker {$this->name} has been reset");
    }

    public function forceOpen(): void
    {
        $this->state = CircuitBreakerState::OPEN;
        $this->lastFailureTime = time() * 1000;
        $this->saveState();
        Log::warning("Circuit breaker {$this->name} forced to OPEN state");
    }

    public function forceClosed(): void
    {
        $this->state = CircuitBreakerState::CLOSED;
        $this->failures = 0;
        $this->successes = 0;
        $this->saveState();
        Log::info("Circuit breaker {$this->name} forced to CLOSED state");
    }

    protected function getCacheKey(): string
    {
        return "circuit_breaker:{$this->name}";
    }

    protected function saveState(): void
    {
        $state = [
            'state' => $this->state->value,
            'failures' => $this->failures,
            'successes' => $this->successes,
            'lastFailureTime' => $this->lastFailureTime,
        ];

        Cache::put($this->getCacheKey(), $state, 3600); // 1 hour TTL
    }

    protected function loadState(): void
    {
        $state = Cache::get($this->getCacheKey());

        if ($state) {
            $this->state = CircuitBreakerState::from($state['state']);
            $this->failures = $state['failures'];
            $this->successes = $state['successes'];
            $this->lastFailureTime = $state['lastFailureTime'];
        }
    }

    public function getHealthStatus(): string
    {
        $state = $this->getState();

        return match ($state) {
            CircuitBreakerState::CLOSED => 'healthy',
            CircuitBreakerState::HALF_OPEN => 'degraded',
            CircuitBreakerState::OPEN => 'unhealthy',
        };
    }

    public static function createForDeepSeek(): self
    {
        return new self(
            'deepseek',
            config('telegram.circuit_breaker.deepseek.failure_threshold', 5),
            config('telegram.circuit_breaker.deepseek.cooldown_ms', 60000),
            config('telegram.circuit_breaker.deepseek.success_threshold', 3)
        );
    }

    public static function createForLaravelApi(): self
    {
        return new self(
            'laravel_api',
            config('telegram.circuit_breaker.laravel_api.failure_threshold', 3),
            config('telegram.circuit_breaker.laravel_api.cooldown_ms', 30000),
            config('telegram.circuit_breaker.laravel_api.success_threshold', 2)
        );
    }
}
