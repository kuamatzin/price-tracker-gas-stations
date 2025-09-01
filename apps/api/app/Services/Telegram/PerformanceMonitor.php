<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class PerformanceMonitor
{
    protected array $activeTimers = [];
    
    protected int $maxActiveTimers = 1000;  // Prevent memory leaks
    
    protected int $timerTimeoutSeconds = 300; // 5 minutes
    
    protected string $metricsPrefix = 'telegram:metrics';

    /**
     * Start timing a command execution
     */
    public function startTimer(string $command, int $userId): string
    {
        // Clean up stale timers before adding new one
        $this->cleanupStaleTimers();
        
        // Prevent memory leaks by limiting active timers
        if (count($this->activeTimers) >= $this->maxActiveTimers) {
            Log::warning('Max active timers reached, cleaning up oldest');
            $this->cleanupOldestTimers(100); // Remove 100 oldest
        }

        $timerId = uniqid("{$command}_{$userId}_");

        $this->activeTimers[$timerId] = [
            'command' => $command,
            'user_id' => $userId,
            'start_time' => microtime(true),
            'start_memory' => memory_get_usage(true),
        ];

        return $timerId;
    }

    /**
     * End timing and record metrics
     */
    public function endTimer(string $timerId): array
    {
        if (! isset($this->activeTimers[$timerId])) {
            return ['error' => 'Timer not found'];
        }

        $timer = $this->activeTimers[$timerId];
        $endTime = microtime(true);
        $endMemory = memory_get_usage(true);

        $metrics = [
            'command' => $timer['command'],
            'user_id' => $timer['user_id'],
            'response_time_ms' => round(($endTime - $timer['start_time']) * 1000, 2),
            'memory_usage_bytes' => $endMemory - $timer['start_memory'],
            'peak_memory_bytes' => memory_get_peak_usage(true),
            'timestamp' => time(),
        ];

        // Record metrics
        $this->recordCommandMetrics($metrics);

        // Check for slow queries
        if ($metrics['response_time_ms'] > $this->getSlowQueryThreshold($timer['command'])) {
            $this->alertSlowQuery($metrics);
        }

        // Cleanup timer
        unset($this->activeTimers[$timerId]);

        return $metrics;
    }

    /**
     * Record command execution metrics
     */
    protected function recordCommandMetrics(array $metrics): void
    {
        try {
            // Store in Redis for real-time monitoring
            $key = "{$this->metricsPrefix}:commands:{$metrics['command']}";

            // Use Redis pipeline for efficiency
            $pipeline = Redis::pipeline();

            // Increment command counter
            $pipeline->incr("{$key}:count");
            $pipeline->expire("{$key}:count", 86400); // 24 hours

            // Add response time to rolling average
            $pipeline->lpush("{$key}:response_times", $metrics['response_time_ms']);
            $pipeline->ltrim("{$key}:response_times", 0, 99); // Keep last 100 responses
            $pipeline->expire("{$key}:response_times", 3600); // 1 hour

            // Add memory usage
            $pipeline->lpush("{$key}:memory_usage", $metrics['memory_usage_bytes']);
            $pipeline->ltrim("{$key}:memory_usage", 0, 99);
            $pipeline->expire("{$key}:memory_usage", 3600);

            // Store in daily aggregates
            $date = date('Y-m-d');
            $pipeline->hincrby("{$this->metricsPrefix}:daily:{$date}", $metrics['command'], 1);
            $pipeline->expire("{$this->metricsPrefix}:daily:{$date}", 86400 * 7); // Keep 7 days

            $pipeline->execute();

            // Also log for detailed analysis
            Log::info('Command performance metrics', $metrics);

        } catch (\Exception $e) {
            Log::error('Failed to record command metrics: '.$e->getMessage());
        }
    }

    /**
     * Get performance statistics for a command
     */
    public function getCommandStats(string $command): array
    {
        try {
            $key = "{$this->metricsPrefix}:commands:{$command}";

            // Get basic stats
            $count = Redis::get("{$key}:count") ?? 0;
            $responseTimes = Redis::lrange("{$key}:response_times", 0, -1);
            $memoryUsages = Redis::lrange("{$key}:memory_usage", 0, -1);

            // Calculate averages
            $avgResponseTime = 0;
            $avgMemoryUsage = 0;
            $maxResponseTime = 0;
            $maxMemoryUsage = 0;

            if (! empty($responseTimes)) {
                $responseTimes = array_map('floatval', $responseTimes);
                $avgResponseTime = round(array_sum($responseTimes) / count($responseTimes), 2);
                $maxResponseTime = max($responseTimes);
            }

            if (! empty($memoryUsages)) {
                $memoryUsages = array_map('intval', $memoryUsages);
                $avgMemoryUsage = round(array_sum($memoryUsages) / count($memoryUsages));
                $maxMemoryUsage = max($memoryUsages);
            }

            return [
                'command' => $command,
                'total_executions' => (int) $count,
                'avg_response_time_ms' => $avgResponseTime,
                'max_response_time_ms' => $maxResponseTime,
                'avg_memory_usage_bytes' => $avgMemoryUsage,
                'max_memory_usage_bytes' => $maxMemoryUsage,
                'sample_size' => count($responseTimes),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get command stats: '.$e->getMessage());

            return [
                'command' => $command,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get overall performance dashboard data
     */
    public function getDashboardData(): array
    {
        try {
            // Get all commands that have metrics
            $pattern = "{$this->metricsPrefix}:commands:*:count";
            $keys = Redis::keys($pattern);

            $commandStats = [];
            foreach ($keys as $key) {
                $command = str_replace(["{$this->metricsPrefix}:commands:", ':count'], '', $key);
                $commandStats[$command] = $this->getCommandStats($command);
            }

            // Sort by total executions
            uasort($commandStats, function ($a, $b) {
                return ($b['total_executions'] ?? 0) <=> ($a['total_executions'] ?? 0);
            });

            // Get daily aggregates
            $dailyStats = $this->getDailyStats();

            // Get system metrics
            $systemMetrics = $this->getSystemMetrics();

            return [
                'commands' => $commandStats,
                'daily' => $dailyStats,
                'system' => $systemMetrics,
                'generated_at' => now()->toISOString(),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get dashboard data: '.$e->getMessage());

            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Track database query count for current request
     */
    public function trackDatabaseQueries(): int
    {
        try {
            $queryLog = \DB::getQueryLog();
            $queryCount = count($queryLog);

            // Store query count in metrics
            $key = "{$this->metricsPrefix}:queries:count";
            Redis::lpush($key, $queryCount);
            Redis::ltrim($key, 0, 999); // Keep last 1000 measurements
            Redis::expire($key, 3600);

            return $queryCount;
        } catch (\Exception $e) {
            Log::error('Failed to track database queries: '.$e->getMessage());

            return 0;
        }
    }

    /**
     * Alert on slow queries
     */
    protected function alertSlowQuery(array $metrics): void
    {
        Log::warning('Slow command detected', [
            'command' => $metrics['command'],
            'response_time_ms' => $metrics['response_time_ms'],
            'threshold_ms' => $this->getSlowQueryThreshold($metrics['command']),
            'user_id' => $metrics['user_id'],
        ]);

        // Send to monitoring
        if (function_exists('app') && app()->bound('sentry')) {
            \Sentry\captureMessage("Slow Telegram command: {$metrics['command']}", \Sentry\Severity::warning());
        }
    }

    /**
     * Get slow query threshold for command
     */
    protected function getSlowQueryThreshold(string $command): int
    {
        // Define thresholds per command type
        $thresholds = [
            'precios' => 3000,     // 3 seconds for price queries
            'analytics' => 5000,   // 5 seconds for analytics
            'nlp' => 2000,         // 2 seconds for NLP processing
            'admin' => 1000,       // 1 second for admin commands
        ];

        // Check if command starts with any threshold key
        foreach ($thresholds as $prefix => $threshold) {
            if (str_starts_with($command, $prefix)) {
                return $threshold;
            }
        }

        return 2000; // Default 2 seconds
    }

    /**
     * Get daily statistics
     */
    protected function getDailyStats(): array
    {
        try {
            $today = date('Y-m-d');
            $yesterday = date('Y-m-d', strtotime('-1 day'));

            $todayStats = Redis::hgetall("{$this->metricsPrefix}:daily:{$today}");
            $yesterdayStats = Redis::hgetall("{$this->metricsPrefix}:daily:{$yesterday}");

            return [
                'today' => $todayStats ?: [],
                'yesterday' => $yesterdayStats ?: [],
            ];
        } catch (\Exception $e) {
            return ['today' => [], 'yesterday' => []];
        }
    }

    /**
     * Get system performance metrics
     */
    protected function getSystemMetrics(): array
    {
        return [
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
            'memory_limit' => $this->parseMemoryLimit(ini_get('memory_limit')),
            'load_average' => $this->getLoadAverage(),
        ];
    }

    /**
     * Export metrics in Prometheus format
     */
    public function exportPrometheusMetrics(): string
    {
        $metrics = [];

        try {
            $dashboardData = $this->getDashboardData();

            if (isset($dashboardData['commands'])) {
                foreach ($dashboardData['commands'] as $command => $stats) {
                    if (isset($stats['total_executions'])) {
                        $metrics[] = '# HELP telegram_command_executions_total Total command executions';
                        $metrics[] = '# TYPE telegram_command_executions_total counter';
                        $metrics[] = "telegram_command_executions_total{command=\"{$command}\"} {$stats['total_executions']}";

                        $metrics[] = '# HELP telegram_command_response_time_ms Average response time in milliseconds';
                        $metrics[] = '# TYPE telegram_command_response_time_ms gauge';
                        $metrics[] = "telegram_command_response_time_ms{command=\"{$command}\"} {$stats['avg_response_time_ms']}";

                        $metrics[] = '# HELP telegram_command_memory_usage_bytes Average memory usage in bytes';
                        $metrics[] = '# TYPE telegram_command_memory_usage_bytes gauge';
                        $metrics[] = "telegram_command_memory_usage_bytes{command=\"{$command}\"} {$stats['avg_memory_usage_bytes']}";
                    }
                }
            }

            // System metrics
            if (isset($dashboardData['system'])) {
                $sys = $dashboardData['system'];

                $metrics[] = '# HELP telegram_memory_usage_bytes Current memory usage';
                $metrics[] = '# TYPE telegram_memory_usage_bytes gauge';
                $metrics[] = "telegram_memory_usage_bytes {$sys['memory_usage']}";

                $metrics[] = '# HELP telegram_memory_peak_bytes Peak memory usage';
                $metrics[] = '# TYPE telegram_memory_peak_bytes gauge';
                $metrics[] = "telegram_memory_peak_bytes {$sys['memory_peak']}";
            }

        } catch (\Exception $e) {
            Log::error('Failed to export Prometheus metrics: '.$e->getMessage());
        }

        return implode("\n", $metrics);
    }

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

    protected function getLoadAverage(): ?float
    {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();

            return $load[0] ?? null; // 1-minute average
        }

        return null;
    }
    
    /**
     * Clean up stale timers that have been running too long
     */
    protected function cleanupStaleTimers(): void
    {
        $currentTime = microtime(true);
        $expiredTimers = [];
        
        foreach ($this->activeTimers as $timerId => $timer) {
            if ($currentTime - $timer['start_time'] > $this->timerTimeoutSeconds) {
                $expiredTimers[] = $timerId;
            }
        }
        
        foreach ($expiredTimers as $timerId) {
            Log::warning('Stale timer cleaned up', [
                'timer_id' => $timerId,
                'command' => $this->activeTimers[$timerId]['command'] ?? 'unknown',
                'age_seconds' => $currentTime - ($this->activeTimers[$timerId]['start_time'] ?? $currentTime)
            ]);
            unset($this->activeTimers[$timerId]);
        }
    }
    
    /**
     * Clean up oldest timers when limit is reached
     */
    protected function cleanupOldestTimers(int $count): void
    {
        // Sort by start time (oldest first)
        uasort($this->activeTimers, function($a, $b) {
            return $a['start_time'] <=> $b['start_time'];
        });
        
        $removed = 0;
        foreach ($this->activeTimers as $timerId => $timer) {
            if ($removed >= $count) break;
            
            Log::warning('Oldest timer cleaned up due to memory limits', [
                'timer_id' => $timerId,
                'command' => $timer['command'] ?? 'unknown',
                'age_seconds' => microtime(true) - $timer['start_time']
            ]);
            
            unset($this->activeTimers[$timerId]);
            $removed++;
        }
    }
    
    /**
     * Get active timer count for monitoring
     */
    public function getActiveTimerCount(): int
    {
        return count($this->activeTimers);
    }
    
    /**
     * Force cleanup all timers (emergency method)
     */
    public function clearAllTimers(): int
    {
        $count = count($this->activeTimers);
        $this->activeTimers = [];
        
        Log::info('All active timers cleared', ['count' => $count]);
        
        return $count;
    }
}
