<?php

namespace App\Http\Controllers\Telegram;

use App\Http\Controllers\Controller;
use App\Services\External\DeepSeekService;
use App\Services\Telegram\CircuitBreaker;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HealthController extends Controller
{
    protected array $circuitBreakers = [];
    
    protected int $healthCheckTimeout = 5; // 5 seconds
    
    protected int $cacheHealthCheckFor = 30; // Cache for 30 seconds

    public function __construct()
    {
        $this->circuitBreakers['deepseek'] = CircuitBreaker::createForDeepSeek();
        $this->circuitBreakers['laravel_api'] = CircuitBreaker::createForLaravelApi();
    }

    /**
     * Overall bot health check (async with caching)
     */
    public function health(): JsonResponse
    {
        $cacheKey = 'telegram:health_check';
        
        // Return cached result if available and fresh
        $cached = Cache::get($cacheKey);
        if ($cached && $cached['cached_at'] > now()->subSeconds($this->cacheHealthCheckFor)->timestamp) {
            $cached['from_cache'] = true;
            return response()->json($cached);
        }

        // Perform async health checks with timeout
        $checks = $this->performAsyncHealthChecks();

        $overallHealth = $this->calculateOverallHealth($checks);

        $response = [
            'status' => $overallHealth,
            'timestamp' => now()->toISOString(),
            'checks' => $checks,
            'cached_at' => now()->timestamp,
            'from_cache' => false,
        ];
        
        // Cache the result
        Cache::put($cacheKey, $response, $this->cacheHealthCheckFor);

        return response()->json($response);
    }

    /**
     * Circuit breaker status
     */
    public function circuits(): JsonResponse
    {
        $circuits = [];

        foreach ($this->circuitBreakers as $name => $breaker) {
            $circuits[$name] = $breaker->getStats();
        }

        return response()->json([
            'circuits' => $circuits,
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Telegram-specific health metrics
     */
    public function status(): JsonResponse
    {
        $activeSessions = $this->getActiveSessionCount();
        $circuitHealth = $this->getCircuitHealth();

        return response()->json([
            'bot_status' => 'operational',
            'active_sessions' => $activeSessions,
            'circuit_health' => $circuitHealth,
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
            'uptime' => $this->getUptime(),
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Prometheus metrics endpoint
     */
    public function metrics(): string
    {
        $activeSessions = $this->getActiveSessionCount();
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);

        $metrics = [];

        // Active sessions
        $metrics[] = '# HELP telegram_active_sessions Number of active Telegram sessions';
        $metrics[] = '# TYPE telegram_active_sessions gauge';
        $metrics[] = "telegram_active_sessions {$activeSessions}";

        // Memory usage
        $metrics[] = '# HELP telegram_memory_usage_bytes Memory usage in bytes';
        $metrics[] = '# TYPE telegram_memory_usage_bytes gauge';
        $metrics[] = "telegram_memory_usage_bytes {$memoryUsage}";

        $metrics[] = '# HELP telegram_memory_peak_bytes Peak memory usage in bytes';
        $metrics[] = '# TYPE telegram_memory_peak_bytes gauge';
        $metrics[] = "telegram_memory_peak_bytes {$memoryPeak}";

        // Circuit breaker states
        foreach ($this->circuitBreakers as $name => $breaker) {
            $stats = $breaker->getStats();
            $stateValue = match ($stats['state']) {
                'CLOSED' => 0,
                'HALF_OPEN' => 1,
                'OPEN' => 2,
            };

            $metrics[] = '# HELP telegram_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)';
            $metrics[] = '# TYPE telegram_circuit_breaker_state gauge';
            $metrics[] = "telegram_circuit_breaker_state{service=\"{$name}\"} {$stateValue}";

            $metrics[] = '# HELP telegram_circuit_breaker_failures Circuit breaker failure count';
            $metrics[] = '# TYPE telegram_circuit_breaker_failures counter';
            $metrics[] = "telegram_circuit_breaker_failures{service=\"{$name}\"} {$stats['failures']}";
        }

        return implode("\n", $metrics);
    }

    protected function checkRedis(): array
    {
        try {
            $start = microtime(true);
            Redis::ping();
            $latency = round((microtime(true) - $start) * 1000, 2);

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'Redis connection OK',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'Redis connection failed: '.$e->getMessage(),
            ];
        }
    }

    protected function checkDatabase(): array
    {
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $latency = round((microtime(true) - $start) * 1000, 2);

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'Database connection OK',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'Database connection failed: '.$e->getMessage(),
            ];
        }
    }

    protected function checkDeepSeek(): array
    {
        $breaker = $this->circuitBreakers['deepseek'];

        if (! $breaker->canAttempt()) {
            return [
                'status' => 'degraded',
                'message' => 'DeepSeek API circuit breaker is OPEN',
                'circuit_state' => $breaker->getState()->value,
            ];
        }

        try {
            $deepSeekService = app(DeepSeekService::class);

            // Simple health check query
            $start = microtime(true);
            $response = $breaker->execute(function () use ($deepSeekService) {
                return $deepSeekService->processQuery('health check');
            });
            $latency = round((microtime(true) - $start) * 1000, 2);

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'DeepSeek API responding',
                'circuit_state' => $breaker->getState()->value,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'DeepSeek API failed: '.$e->getMessage(),
                'circuit_state' => $breaker->getState()->value,
            ];
        }
    }

    protected function checkCircuitBreakers(): array
    {
        $statuses = [];

        foreach ($this->circuitBreakers as $name => $breaker) {
            $stats = $breaker->getStats();
            $statuses[$name] = [
                'state' => $stats['state'],
                'health_status' => $breaker->getHealthStatus(),
                'failures' => $stats['failures'],
                'can_attempt' => $stats['canAttempt'],
            ];
        }

        $overallStatus = 'healthy';
        foreach ($statuses as $status) {
            if ($status['health_status'] === 'unhealthy') {
                $overallStatus = 'unhealthy';
                break;
            } elseif ($status['health_status'] === 'degraded') {
                $overallStatus = 'degraded';
            }
        }

        return [
            'status' => $overallStatus,
            'circuits' => $statuses,
        ];
    }

    protected function calculateOverallHealth(array $checks): string
    {
        $unhealthyCount = 0;
        $degradedCount = 0;

        foreach ($checks as $check) {
            if (isset($check['status'])) {
                if ($check['status'] === 'unhealthy') {
                    $unhealthyCount++;
                } elseif ($check['status'] === 'degraded') {
                    $degradedCount++;
                }
            }
        }

        if ($unhealthyCount > 0) {
            return 'unhealthy';
        } elseif ($degradedCount > 0) {
            return 'degraded';
        }

        return 'healthy';
    }

    protected function getActiveSessionCount(): int
    {
        try {
            $pattern = 'telegram:session:*';
            $keys = Redis::keys($pattern);

            return count($keys);
        } catch (\Exception $e) {
            return -1;
        }
    }

    protected function getCircuitHealth(): array
    {
        $health = [];

        foreach ($this->circuitBreakers as $name => $breaker) {
            $health[$name] = $breaker->getHealthStatus();
        }

        return $health;
    }

    protected function getUptime(): int
    {
        return (int) (microtime(true) - LARAVEL_START);
    }
    
    /**
     * Perform async health checks with timeout protection
     */
    protected function performAsyncHealthChecks(): array
    {
        $checks = [];
        
        // Use timeout wrapper for each check
        $checks['redis'] = $this->runHealthCheckWithTimeout('redis', [$this, 'checkRedis']);
        $checks['database'] = $this->runHealthCheckWithTimeout('database', [$this, 'checkDatabase']);
        $checks['deepseek'] = $this->runHealthCheckWithTimeout('deepseek', [$this, 'checkDeepSeek']);
        $checks['circuit_breakers'] = $this->runHealthCheckWithTimeout('circuit_breakers', [$this, 'checkCircuitBreakers']);
        
        return $checks;
    }
    
    /**
     * Run health check with timeout protection
     */
    protected function runHealthCheckWithTimeout(string $checkName, callable $checkFunction): array
    {
        $startTime = microtime(true);
        
        try {
            // Set a maximum execution time for the health check
            set_time_limit($this->healthCheckTimeout);
            
            $result = call_user_func($checkFunction);
            
            // Reset time limit
            set_time_limit(0);
            
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            $result['check_duration_ms'] = $duration;
            
            return $result;
            
        } catch (\Exception $e) {
            // Reset time limit
            set_time_limit(0);
            
            $duration = round((microtime(true) - $startTime) * 1000, 2);
            
            return [
                'status' => 'unhealthy',
                'message' => "Health check '{$checkName}' failed: " . $e->getMessage(),
                'check_duration_ms' => $duration,
                'error_type' => get_class($e),
            ];
        }
    }
    
    /**
     * Async Redis check with circuit breaker pattern
     */
    protected function checkRedisAsync(): array
    {
        $cacheKey = 'health:redis';
        $cached = Cache::get($cacheKey);
        
        if ($cached && $cached['checked_at'] > now()->subSeconds(10)->timestamp) {
            return $cached;
        }
        
        try {
            $start = microtime(true);
            
            // Use a very short timeout for Redis ping
            $connection = Redis::connection();
            $connection->eval("
                redis.call('ping')
                return 'PONG'
            ", 0);
            
            $latency = round((microtime(true) - $start) * 1000, 2);

            $result = [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'Redis connection OK',
                'checked_at' => now()->timestamp,
            ];
            
            Cache::put($cacheKey, $result, 30); // Cache for 30 seconds
            return $result;
            
        } catch (\Exception $e) {
            $result = [
                'status' => 'unhealthy',
                'message' => 'Redis connection failed: ' . $e->getMessage(),
                'checked_at' => now()->timestamp,
            ];
            
            // Cache failed result for shorter time
            Cache::put($cacheKey, $result, 5);
            return $result;
        }
    }
    
    /**
     * Async database check with circuit breaker pattern
     */
    protected function checkDatabaseAsync(): array
    {
        $cacheKey = 'health:database';
        $cached = Cache::get($cacheKey);
        
        if ($cached && $cached['checked_at'] > now()->subSeconds(15)->timestamp) {
            return $cached;
        }
        
        try {
            $start = microtime(true);
            
            // Use a simple, fast query
            DB::select('SELECT 1 as test LIMIT 1');
            
            $latency = round((microtime(true) - $start) * 1000, 2);

            $result = [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'Database connection OK',
                'checked_at' => now()->timestamp,
            ];
            
            Cache::put($cacheKey, $result, 30);
            return $result;
            
        } catch (\Exception $e) {
            $result = [
                'status' => 'unhealthy',
                'message' => 'Database connection failed: ' . $e->getMessage(),
                'checked_at' => now()->timestamp,
            ];
            
            Cache::put($cacheKey, $result, 5);
            return $result;
        }
    }
}
