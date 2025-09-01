<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class StatusController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/status/dashboard",
     *     operationId="getStatusDashboard",
     *     tags={"Status"},
     *     summary="Get API status dashboard",
     *     description="Returns comprehensive API health and performance metrics",
     *     security={{"sanctum":{}}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="service", type="string", example="FuelIntel API"),
     *             @OA\Property(property="version", type="string", example="1.0.0"),
     *             @OA\Property(property="status", type="string", example="operational"),
     *             @OA\Property(property="endpoints", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="system", type="object"),
     *             @OA\Property(property="timestamp", type="string", format="date-time")
     *         )
     *     )
     * )
     */
    public function dashboard(): JsonResponse
    {
        $endpoints = [
            '/api/v1/prices/current',
            '/api/v1/prices/nearby',
            '/api/v1/trends/market',
            '/api/v1/competitors',
            '/api/v1/geo/estados',
            '/api/v1/analysis/insights',
        ];

        $status = [];

        foreach ($endpoints as $endpoint) {
            $metrics = Cache::get("metrics:$endpoint", [
                'response_time_avg' => 0,
                'response_time_p95' => 0,
                'error_rate' => 0,
                'requests_per_minute' => 0,
                'last_error' => null,
                'status' => 'operational',
            ]);

            $status[] = [
                'endpoint' => $endpoint,
                'status' => $this->determineStatus($metrics),
                'metrics' => $metrics,
                'uptime' => $this->calculateUptime($endpoint),
            ];
        }

        return response()->json([
            'service' => 'FuelIntel API',
            'version' => config('app.version', '1.0.0'),
            'status' => $this->getOverallStatus($status),
            'endpoints' => $status,
            'system' => [
                'database' => $this->checkDatabase(),
                'redis' => $this->checkRedis(),
                'disk_usage' => $this->getDiskUsage(),
                'memory_usage' => $this->getMemoryUsage(),
                'cpu_usage' => $this->getCpuUsage(),
                'queue_size' => $this->getQueueSize(),
            ],
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/status/health",
     *     operationId="getHealthCheck",
     *     tags={"Status"},
     *     summary="Simple health check",
     *     description="Returns basic health status",
     *
     *     @OA\Response(
     *         response=200,
     *         description="Service is healthy",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="status", type="string", example="healthy"),
     *             @OA\Property(property="timestamp", type="string", format="date-time")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=503,
     *         description="Service is unhealthy",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="status", type="string", example="unhealthy"),
     *             @OA\Property(property="errors", type="array", @OA\Items(type="string"))
     *         )
     *     )
     * )
     */
    public function health(): JsonResponse
    {
        $errors = [];
        $isHealthy = true;

        // Check database connection
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $errors[] = 'Database connection failed';
            $isHealthy = false;
        }

        // Check Redis connection
        try {
            Redis::ping();
        } catch (\Exception $e) {
            $errors[] = 'Redis connection failed';
            $isHealthy = false;
        }

        // Check disk space
        $diskFreePercent = $this->getDiskFreePercentage();
        if ($diskFreePercent < 10) {
            $errors[] = "Low disk space: {$diskFreePercent}% free";
            $isHealthy = false;
        }

        if ($isHealthy) {
            return response()->json([
                'status' => 'healthy',
                'timestamp' => now()->toIso8601String(),
            ]);
        }

        return response()->json([
            'status' => 'unhealthy',
            'errors' => $errors,
            'timestamp' => now()->toIso8601String(),
        ], 503);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/status/metrics",
     *     operationId="getMetrics",
     *     tags={"Status"},
     *     summary="Get detailed metrics",
     *     description="Returns detailed performance and usage metrics",
     *     security={{"sanctum":{}}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(type="object")
     *     )
     * )
     */
    public function metrics(): JsonResponse
    {
        $metrics = [
            'api' => [
                'total_requests_today' => Cache::get('metrics:requests:today', 0),
                'total_requests_hour' => Cache::get('metrics:requests:hour', 0),
                'unique_users_today' => Cache::get('metrics:users:today', 0),
                'average_response_time' => Cache::get('metrics:response:avg', 0),
                'error_rate' => Cache::get('metrics:errors:rate', 0),
            ],
            'database' => [
                'active_connections' => $this->getDatabaseConnections(),
                'slow_queries_count' => Cache::get('metrics:db:slow_queries', 0),
                'cache_hit_rate' => Cache::get('metrics:cache:hit_rate', 0),
            ],
            'scraper' => [
                'last_run' => Cache::get('scraper:last_run'),
                'last_success' => Cache::get('scraper:last_success'),
                'stations_updated' => Cache::get('scraper:stations_updated', 0),
                'prices_changed' => Cache::get('scraper:prices_changed', 0),
            ],
            'system' => [
                'uptime_seconds' => $this->getSystemUptime(),
                'load_average' => sys_getloadavg(),
                'memory' => [
                    'used_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
                    'peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
                ],
            ],
            'timestamp' => now()->toIso8601String(),
        ];

        return response()->json($metrics);
    }

    private function determineStatus(array $metrics): string
    {
        if ($metrics['error_rate'] > 5) {
            return 'degraded';
        }

        if ($metrics['response_time_p95'] > 1000) {
            return 'slow';
        }

        return 'operational';
    }

    private function getOverallStatus(array $endpoints): string
    {
        $statusCounts = array_count_values(array_column($endpoints, 'status'));

        if (($statusCounts['degraded'] ?? 0) > 2) {
            return 'major_outage';
        }

        if (($statusCounts['degraded'] ?? 0) > 0) {
            return 'partial_outage';
        }

        if (($statusCounts['slow'] ?? 0) > 2) {
            return 'degraded_performance';
        }

        return 'operational';
    }

    private function calculateUptime(string $endpoint): float
    {
        $downtimeMinutes = Cache::get("downtime:$endpoint:today", 0);
        $totalMinutes = now()->diffInMinutes(now()->startOfDay());

        if ($totalMinutes == 0) {
            return 100.0;
        }

        return round(($totalMinutes - $downtimeMinutes) / $totalMinutes * 100, 2);
    }

    private function checkDatabase(): string
    {
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $responseTime = round((microtime(true) - $start) * 1000, 2);

            if ($responseTime > 100) {
                return "slow ({$responseTime}ms)";
            }

            return 'operational';
        } catch (\Exception $e) {
            return 'down';
        }
    }

    private function checkRedis(): string
    {
        try {
            $start = microtime(true);
            Redis::ping();
            $responseTime = round((microtime(true) - $start) * 1000, 2);

            if ($responseTime > 50) {
                return "slow ({$responseTime}ms)";
            }

            return 'operational';
        } catch (\Exception $e) {
            return 'down';
        }
    }

    private function getDiskUsage(): float
    {
        $total = disk_total_space('/');
        $free = disk_free_space('/');

        if ($total == 0) {
            return 0;
        }

        return round(($total - $free) / $total * 100, 2);
    }

    private function getDiskFreePercentage(): float
    {
        $total = disk_total_space('/');
        $free = disk_free_space('/');

        if ($total == 0) {
            return 0;
        }

        return round($free / $total * 100, 2);
    }

    private function getMemoryUsage(): float
    {
        $memInfo = file_get_contents('/proc/meminfo');

        if (! $memInfo) {
            // Fallback for non-Linux systems
            return round(memory_get_usage(true) / memory_get_peak_usage(true) * 100, 2);
        }

        preg_match('/MemTotal:\s+(\d+)/', $memInfo, $totalMatch);
        preg_match('/MemAvailable:\s+(\d+)/', $memInfo, $availableMatch);

        if (isset($totalMatch[1]) && isset($availableMatch[1])) {
            $total = (int) $totalMatch[1];
            $available = (int) $availableMatch[1];

            if ($total == 0) {
                return 0;
            }

            return round(($total - $available) / $total * 100, 2);
        }

        return 0;
    }

    private function getCpuUsage(): float
    {
        $load = sys_getloadavg();
        $cpuCount = 1;

        if (is_readable('/proc/cpuinfo')) {
            $cpuInfo = file_get_contents('/proc/cpuinfo');
            preg_match_all('/processor\s+:/', $cpuInfo, $matches);
            $cpuCount = count($matches[0]) ?: 1;
        }

        // Use 1-minute load average
        return round(($load[0] / $cpuCount) * 100, 2);
    }

    private function getQueueSize(): int
    {
        try {
            return (int) Redis::llen('queues:default');
        } catch (\Exception $e) {
            return 0;
        }
    }

    private function getDatabaseConnections(): int
    {
        try {
            $result = DB::select("SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'");

            return $result[0]->count ?? 0;
        } catch (\Exception $e) {
            return 0;
        }
    }

    private function getSystemUptime(): int
    {
        if (is_readable('/proc/uptime')) {
            $uptime = file_get_contents('/proc/uptime');
            $seconds = (int) explode(' ', $uptime)[0];

            return $seconds;
        }

        // Fallback for non-Linux systems
        return (int) Cache::get('system:start_time', time()) - time();
    }
}
