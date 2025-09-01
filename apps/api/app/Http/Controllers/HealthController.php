<?php

namespace App\Http\Controllers;

use App\Services\ScraperRunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class HealthController extends Controller
{
    public function __construct(
        private ScraperRunService $scraperRunService
    ) {}

    public function index(): JsonResponse
    {
        $startTime = microtime(true);

        $health = [
            'status' => 'healthy',
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => $this->checkDatabase(),
                'redis' => $this->checkRedis(),
                'scraper' => $this->checkScraper(),
                'scraper_integration' => $this->checkScraperIntegration(),
            ],
            'data_freshness' => $this->scraperRunService->getDataFreshness(),
            'version' => $this->getVersionInfo(),
            'response_time_ms' => null,
        ];

        $overallStatus = $this->determineOverallStatus($health['services']);
        $health['status'] = $overallStatus;
        $health['response_time_ms'] = round((microtime(true) - $startTime) * 1000, 2);

        return response()->json($health, $overallStatus === 'healthy' ? 200 : 503);
    }

    private function checkDatabase(): array
    {
        $startTime = microtime(true);

        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');

            return [
                'status' => 'connected',
                'latency_ms' => round((microtime(true) - $startTime) * 1000, 2),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'disconnected',
                'error' => $e->getMessage(),
                'latency_ms' => round((microtime(true) - $startTime) * 1000, 2),
            ];
        }
    }

    private function checkRedis(): array
    {
        $startTime = microtime(true);

        try {
            if (config('cache.default') === 'file') {
                return [
                    'status' => 'using_file_cache',
                    'latency_ms' => 0,
                ];
            }

            $testKey = 'health_check_'.time();
            Cache::put($testKey, 'test', 1);
            $value = Cache::get($testKey);
            Cache::forget($testKey);

            if ($value !== 'test') {
                throw new \Exception('Redis read/write test failed');
            }

            return [
                'status' => 'connected',
                'latency_ms' => round((microtime(true) - $startTime) * 1000, 2),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'disconnected',
                'error' => 'Redis not available - '.$e->getMessage(),
                'latency_ms' => round((microtime(true) - $startTime) * 1000, 2),
            ];
        }
    }

    private function checkScraper(): array
    {
        try {
            $lastRun = DB::table('scraper_runs')
                ->orderBy('started_at', 'desc')
                ->first();

            if (! $lastRun) {
                return [
                    'last_run' => null,
                    'status' => 'never_run',
                    'next_run' => $this->getNextScheduledRun(),
                ];
            }

            $status = $lastRun->status ?? 'unknown';
            if ($lastRun->completed_at === null && $lastRun->started_at) {
                $runningFor = now()->diffInMinutes($lastRun->started_at);
                if ($runningFor > 60) {
                    $status = 'possibly_stuck';
                } else {
                    $status = 'running';
                }
            }

            return [
                'last_run' => $lastRun->completed_at ?? $lastRun->started_at,
                'status' => $status,
                'next_run' => $this->getNextScheduledRun(),
                'stations_processed' => $lastRun->stations_processed ?? 0,
                'price_changes' => $lastRun->price_changes_detected ?? 0,
            ];
        } catch (\Exception $e) {
            return [
                'last_run' => null,
                'status' => 'error',
                'error' => $e->getMessage(),
                'next_run' => $this->getNextScheduledRun(),
            ];
        }
    }

    private function getNextScheduledRun(): string
    {
        $runTime = config('scraper.run_time', '05:00');
        $nextRun = now()->parse($runTime);

        if ($nextRun->isPast()) {
            $nextRun->addDay();
        }

        return $nextRun->toIso8601String();
    }

    private function getVersionInfo(): array
    {
        return [
            'api' => config('app.version', '1.0.0'),
            'laravel' => app()->version(),
            'php' => PHP_VERSION,
        ];
    }

    private function checkScraperIntegration(): array
    {
        $startTime = microtime(true);
        $result = [
            'health_endpoint' => 'unknown',
            'metrics_endpoint' => 'unknown',
            'latency_ms' => 0,
        ];

        // Check scraper health endpoint
        try {
            $healthUrl = config('scraper.health_url');
            if ($healthUrl) {
                $response = Http::timeout(5)->get($healthUrl);
                if ($response->successful()) {
                    $result['health_endpoint'] = 'available';
                    $healthData = $response->json();
                    $result['scraper_status'] = $healthData['status'] ?? 'unknown';
                } else {
                    $result['health_endpoint'] = 'unavailable';
                }
            }
        } catch (\Exception $e) {
            $result['health_endpoint'] = 'error';
            $result['health_error'] = $e->getMessage();
        }

        // Check scraper metrics endpoint
        try {
            $metricsUrl = config('scraper.metrics_url');
            if ($metricsUrl) {
                $response = Http::timeout(5)->get($metricsUrl);
                if ($response->successful()) {
                    $result['metrics_endpoint'] = 'available';
                } else {
                    $result['metrics_endpoint'] = 'unavailable';
                }
            }
        } catch (\Exception $e) {
            $result['metrics_endpoint'] = 'error';
            $result['metrics_error'] = $e->getMessage();
        }

        $result['latency_ms'] = round((microtime(true) - $startTime) * 1000, 2);

        return $result;
    }

    private function determineOverallStatus(array $services): string
    {
        $criticalServices = ['database'];

        foreach ($criticalServices as $service) {
            if (isset($services[$service]) &&
                ($services[$service]['status'] === 'disconnected' ||
                 $services[$service]['status'] === 'error')) {
                return 'unhealthy';
            }
        }

        // Check if data is stale
        if ($this->scraperRunService->isDataStale()) {
            return 'degraded';
        }

        foreach ($services as $service) {
            if (isset($service['status']) &&
                ($service['status'] === 'disconnected' ||
                 $service['status'] === 'error' ||
                 $service['status'] === 'possibly_stuck')) {
                return 'degraded';
            }
        }

        return 'healthy';
    }
}
