<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class DegradationManager
{
    protected string $currentLevel = 'healthy';

    protected array $degradationLevels;

    protected array $circuitBreakers = [];

    protected array $cachedResponses = [];

    public function __construct()
    {
        $this->degradationLevels = config('telegram.degradation_levels', []);
        $this->initializeCircuitBreakers();
        $this->loadCachedResponses();
        $this->assessCurrentLevel();
    }

    /**
     * Get current degradation level
     */
    public function getCurrentLevel(): string
    {
        return $this->currentLevel;
    }

    /**
     * Check if feature is enabled based on current degradation level
     */
    public function isFeatureEnabled(string $feature): bool
    {
        $levelConfig = $this->degradationLevels[$this->currentLevel] ?? [];

        return match ($feature) {
            'nlp' => ! ($levelConfig['disable_nlp'] ?? false),
            'analytics' => ! ($levelConfig['disable_analytics'] ?? false),
            'all_features' => $levelConfig['all_features'] ?? false,
            default => true,
        };
    }

    /**
     * Check if system is in read-only mode
     */
    public function isReadOnlyMode(): bool
    {
        $levelConfig = $this->degradationLevels[$this->currentLevel] ?? [];

        return $levelConfig['read_only'] ?? false;
    }

    /**
     * Check if slow mode is enabled
     */
    public function isSlowModeEnabled(): bool
    {
        $levelConfig = $this->degradationLevels[$this->currentLevel] ?? [];

        return $levelConfig['slow_mode'] ?? false;
    }

    /**
     * Get fallback response for a service
     */
    public function getFallbackResponse(string $service, ?string $query = null): ?string
    {
        // Check if we have cached responses for this service
        if (isset($this->cachedResponses[$service])) {
            $responses = $this->cachedResponses[$service];

            // Try to find a relevant response based on query
            if ($query) {
                $queryLower = strtolower($query);

                foreach ($responses as $pattern => $response) {
                    if (str_contains($queryLower, strtolower($pattern))) {
                        return $response;
                    }
                }
            }

            // Return generic response for the service
            return $responses['default'] ?? null;
        }

        return $this->getGenericFallbackResponse($service);
    }

    /**
     * Assess current degradation level based on system health
     */
    public function assessCurrentLevel(): string
    {
        $healthChecks = $this->performHealthAssessment();
        $newLevel = $this->determineDegradationLevel($healthChecks);

        if ($newLevel !== $this->currentLevel) {
            $this->changeDegradationLevel($newLevel);
        }

        return $this->currentLevel;
    }

    /**
     * Force set degradation level (admin function)
     */
    public function forceDegradationLevel(string $level): bool
    {
        if (! isset($this->degradationLevels[$level])) {
            return false;
        }

        $oldLevel = $this->currentLevel;
        $this->changeDegradationLevel($level);

        Log::warning('Degradation level manually changed', [
            'old_level' => $oldLevel,
            'new_level' => $level,
            'forced' => true,
        ]);

        return true;
    }

    /**
     * Get degradation status report
     */
    public function getStatusReport(): array
    {
        $healthChecks = $this->performHealthAssessment();

        return [
            'current_level' => $this->currentLevel,
            'health_checks' => $healthChecks,
            'features' => [
                'nlp_enabled' => $this->isFeatureEnabled('nlp'),
                'analytics_enabled' => $this->isFeatureEnabled('analytics'),
                'read_only_mode' => $this->isReadOnlyMode(),
                'slow_mode_enabled' => $this->isSlowModeEnabled(),
            ],
            'circuit_breakers' => $this->getCircuitBreakerStates(),
            'cached_responses_available' => ! empty($this->cachedResponses),
        ];
    }

    /**
     * Initialize circuit breakers for monitoring
     */
    protected function initializeCircuitBreakers(): void
    {
        $this->circuitBreakers = [
            'deepseek' => CircuitBreaker::createForDeepSeek(),
            'laravel_api' => CircuitBreaker::createForLaravelApi(),
        ];
    }

    /**
     * Load cached responses for fallback scenarios
     */
    protected function loadCachedResponses(): void
    {
        $this->cachedResponses = [
            'deepseek' => [
                'precio' => 'Los precios están temporalmente no disponibles. Usa /precios para consultar precios básicos.',
                'gasolina' => 'Consulta de gasolina no disponible temporalmente. Intenta más tarde.',
                'default' => 'El servicio de consultas inteligentes está temporalmente no disponible. Usa comandos básicos como /precios.',
            ],
            'price_query' => [
                'precios' => 'Mostrando precios desde caché (pueden no estar actualizados).',
                'default' => 'Los precios pueden no estar actualizados debido a problemas técnicos.',
            ],
            'analytics' => [
                'tendencia' => 'Las tendencias no están disponibles temporalmente.',
                'analisis' => 'El análisis está temporalmente no disponible.',
                'default' => 'Los servicios de análisis están en mantenimiento.',
            ],
        ];
    }

    /**
     * Perform health assessment of all services
     */
    protected function performHealthAssessment(): array
    {
        $checks = [];

        // Check Redis connectivity
        try {
            Redis::ping();
            $checks['redis'] = 'healthy';
        } catch (\Exception $e) {
            $checks['redis'] = 'unhealthy';
        }

        // Check database connectivity
        try {
            \DB::select('SELECT 1');
            $checks['database'] = 'healthy';
        } catch (\Exception $e) {
            $checks['database'] = 'unhealthy';
        }

        // Check circuit breaker states
        $checks['circuit_breakers'] = $this->getCircuitBreakerStates();

        // Check system resources
        $memoryUsage = memory_get_usage(true);
        $memoryLimit = $this->parseMemoryLimit(ini_get('memory_limit'));
        $memoryPercentage = $memoryLimit > 0 ? ($memoryUsage / $memoryLimit) * 100 : 0;

        if ($memoryPercentage > 90) {
            $checks['memory'] = 'unhealthy';
        } elseif ($memoryPercentage > 75) {
            $checks['memory'] = 'degraded';
        } else {
            $checks['memory'] = 'healthy';
        }

        return $checks;
    }

    /**
     * Determine appropriate degradation level
     */
    protected function determineDegradationLevel(array $healthChecks): string
    {
        $unhealthyServices = 0;
        $degradedServices = 0;

        foreach ($healthChecks as $service => $status) {
            if ($service === 'circuit_breakers') {
                foreach ($status as $breakerStatus) {
                    if ($breakerStatus === 'unhealthy') {
                        $unhealthyServices++;
                    } elseif ($breakerStatus === 'degraded') {
                        $degradedServices++;
                    }
                }
            } else {
                if ($status === 'unhealthy') {
                    $unhealthyServices++;
                } elseif ($status === 'degraded') {
                    $degradedServices++;
                }
            }
        }

        // Determine level based on failed services
        if ($unhealthyServices >= 2 || $healthChecks['database'] === 'unhealthy') {
            return 'unhealthy';
        } elseif ($unhealthyServices >= 1 || $degradedServices >= 2) {
            return 'degraded';
        }

        return 'healthy';
    }

    /**
     * Change degradation level and notify
     */
    protected function changeDegradationLevel(string $newLevel): void
    {
        $oldLevel = $this->currentLevel;
        $this->currentLevel = $newLevel;

        // Cache the current level
        Cache::put('telegram:degradation_level', $newLevel, 3600);

        Log::info('Degradation level changed', [
            'old_level' => $oldLevel,
            'new_level' => $newLevel,
            'timestamp' => now()->toISOString(),
        ]);

        // Notify monitoring
        if (function_exists('app') && app()->bound('sentry')) {
            \Sentry\captureMessage("Telegram bot degradation level changed to: {$newLevel}", \Sentry\Severity::info());
        }
    }

    /**
     * Get circuit breaker states for health assessment
     */
    protected function getCircuitBreakerStates(): array
    {
        $states = [];

        foreach ($this->circuitBreakers as $name => $breaker) {
            $health = $breaker->getHealthStatus();
            $states[$name] = $health;
        }

        return $states;
    }

    /**
     * Get generic fallback response
     */
    protected function getGenericFallbackResponse(string $service): string
    {
        return config('telegram.error_messages.service_unavailable') ??
               '🔧 El servicio está temporalmente no disponible. Estamos trabajando para solucionarlo.';
    }

    /**
     * Parse memory limit string to bytes
     */
    protected function parseMemoryLimit(string $limit): int
    {
        $value = (int) $limit;
        $unit = strtolower(substr($limit, -1));

        return match ($unit) {
            'g' => $value * 1024 * 1024 * 1024,
            'm' => $value * 1024 * 1024,
            'k' => $value * 1024,
            default => $value,
        };
    }
}
