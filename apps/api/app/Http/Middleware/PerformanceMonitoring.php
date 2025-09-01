<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Sentry\SentrySdk;

class PerformanceMonitoring
{
    public function handle(Request $request, Closure $next)
    {
        $startTime = microtime(true);
        $startMemory = memory_get_usage(true);

        $response = $next($request);

        $endTime = microtime(true);
        $endMemory = memory_get_usage(true);

        $responseTime = round(($endTime - $startTime) * 1000, 2);
        $memoryUsage = $endMemory - $startMemory;

        $this->logPerformanceMetrics($request, $response, $responseTime, $memoryUsage);
        $this->trackCacheMetrics($request);
        $this->alertOnSlowQueries($request, $responseTime);

        return $response;
    }

    private function logPerformanceMetrics(Request $request, $response, float $responseTime, int $memoryUsage): void
    {
        $context = [
            'endpoint' => $request->path(),
            'method' => $request->method(),
            'response_time_ms' => $responseTime,
            'memory_usage_bytes' => $memoryUsage,
            'status_code' => $response->status(),
            'query_count' => count(\DB::getQueryLog() ?? []),
            'user_id' => auth()->id(),
            'ip' => $request->ip(),
        ];

        if ($responseTime > 500) {
            Log::warning('Slow API response detected', $context);
        } else {
            Log::info('API performance metrics', $context);
        }

        // Send to Sentry for monitoring
        if (function_exists('\\Sentry\\SentrySdk::getCurrentHub')) {
            $hub = SentrySdk::getCurrentHub();
            $hub->configureScope(function ($scope) use ($context) {
                $scope->setContext('performance', $context);
            });
        }
    }

    private function trackCacheMetrics(Request $request): void
    {
        if (str_contains($request->path(), 'prices')) {
            $cacheKey = 'cache_metrics:'.date('Y-m-d-H');

            $metrics = Cache::get($cacheKey, [
                'hits' => 0,
                'misses' => 0,
                'requests' => 0,
            ]);

            $metrics['requests']++;

            // Check if request likely hit cache (presence of fresh parameter)
            if (! $request->boolean('fresh', false)) {
                $metrics['hits']++;
            } else {
                $metrics['misses']++;
            }

            Cache::put($cacheKey, $metrics, 3600);

            // Log cache hit rate every hour
            if ($metrics['requests'] % 100 === 0) {
                $hitRate = $metrics['hits'] > 0 ?
                    round(($metrics['hits'] / $metrics['requests']) * 100, 2) : 0;

                Log::info('Cache hit rate', [
                    'hit_rate_percent' => $hitRate,
                    'total_requests' => $metrics['requests'],
                    'cache_hits' => $metrics['hits'],
                    'cache_misses' => $metrics['misses'],
                ]);
            }
        }
    }

    private function alertOnSlowQueries(Request $request, float $responseTime): void
    {
        if ($responseTime > 500) {
            Log::error('Slow query alert', [
                'endpoint' => $request->path(),
                'response_time_ms' => $responseTime,
                'threshold_ms' => 500,
                'queries' => \DB::getQueryLog(),
            ]);

            // Send alert to Sentry
            if (function_exists('\\Sentry\\captureMessage')) {
                \Sentry\captureMessage(
                    "Slow API response: {$request->path()} took {$responseTime}ms",
                    \Sentry\Severity::warning()
                );
            }
        }
    }
}
