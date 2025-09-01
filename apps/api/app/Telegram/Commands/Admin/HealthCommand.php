<?php

namespace App\Telegram\Commands\Admin;

use App\Services\External\DeepSeekService;
use App\Services\Telegram\CircuitBreaker;
use App\Services\Telegram\ConcurrencyManager;
use App\Telegram\Commands\BaseCommand;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HealthCommand extends BaseCommand
{
    protected $name = 'admin_health';

    protected $description = 'Mostrar estado de salud de los servicios (Solo admin)';

    public function handle(): void
    {
        $chatId = $this->getChatId();

        // Check admin authorization
        if (! $this->isAdmin($chatId)) {
            $this->replyWithMessage([
                'text' => config('telegram.error_messages.unauthorized'),
            ]);

            return;
        }

        try {
            $healthStatus = $this->performHealthChecks();
            $message = $this->formatHealthMessage($healthStatus);

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => '❌ Error al verificar estado de salud: '.$e->getMessage(),
            ]);
        }
    }

    protected function performHealthChecks(): array
    {
        $checks = [];

        // Redis health check
        $checks['redis'] = $this->checkRedis();

        // Database health check
        $checks['database'] = $this->checkDatabase();

        // DeepSeek API health check
        $checks['deepseek'] = $this->checkDeepSeek();

        // Circuit breaker status
        $checks['circuit_breakers'] = $this->checkCircuitBreakers();

        // System resources
        $checks['system'] = $this->checkSystemResources();

        // Bot-specific metrics
        $checks['bot'] = $this->checkBotMetrics();

        return $checks;
    }

    protected function checkRedis(): array
    {
        try {
            $start = microtime(true);
            $result = Redis::ping();
            $latency = round((microtime(true) - $start) * 1000, 2);

            // Test set/get operation
            $testKey = 'health_check_'.time();
            Redis::setex($testKey, 10, 'test');
            $testValue = Redis::get($testKey);
            Redis::del($testKey);

            if ($testValue !== 'test') {
                throw new \Exception('Redis read/write test failed');
            }

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'Redis funcionando correctamente',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'Redis fallo: '.$e->getMessage(),
            ];
        }
    }

    protected function checkDatabase(): array
    {
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $latency = round((microtime(true) - $start) * 1000, 2);

            // Test a simple query
            $userCount = DB::table('users')->count();

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => "Base de datos funcionando ({$userCount} usuarios)",
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'Base de datos fallo: '.$e->getMessage(),
            ];
        }
    }

    protected function checkDeepSeek(): array
    {
        try {
            $deepSeekService = app(DeepSeekService::class);
            $circuitBreaker = CircuitBreaker::createForDeepSeek();

            if (! $circuitBreaker->canAttempt()) {
                return [
                    'status' => 'degraded',
                    'message' => 'DeepSeek API circuit breaker abierto',
                    'circuit_state' => $circuitBreaker->getState()->value,
                ];
            }

            $start = microtime(true);
            $response = $circuitBreaker->execute(function () use ($deepSeekService) {
                return $deepSeekService->processQuery('health check');
            });
            $latency = round((microtime(true) - $start) * 1000, 2);

            return [
                'status' => 'healthy',
                'latency_ms' => $latency,
                'message' => 'DeepSeek API respondiendo',
                'circuit_state' => $circuitBreaker->getState()->value,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unhealthy',
                'message' => 'DeepSeek API fallo: '.$e->getMessage(),
            ];
        }
    }

    protected function checkCircuitBreakers(): array
    {
        $deepSeekBreaker = CircuitBreaker::createForDeepSeek();
        $laravelApiBreaker = CircuitBreaker::createForLaravelApi();

        $circuits = [
            'deepseek' => $deepSeekBreaker->getStats(),
            'laravel_api' => $laravelApiBreaker->getStats(),
        ];

        $overallStatus = 'healthy';
        foreach ($circuits as $name => $stats) {
            if ($stats['state'] === 'OPEN') {
                $overallStatus = 'unhealthy';
                break;
            } elseif ($stats['state'] === 'HALF_OPEN') {
                $overallStatus = 'degraded';
            }
        }

        return [
            'status' => $overallStatus,
            'circuits' => $circuits,
        ];
    }

    protected function checkSystemResources(): array
    {
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);
        $memoryLimit = $this->parseMemoryLimit(ini_get('memory_limit'));

        $memoryPercentage = $memoryLimit > 0 ? round(($memoryUsage / $memoryLimit) * 100, 2) : 0;

        $status = 'healthy';
        if ($memoryPercentage > 90) {
            $status = 'unhealthy';
        } elseif ($memoryPercentage > 75) {
            $status = 'degraded';
        }

        return [
            'status' => $status,
            'memory_usage' => $memoryUsage,
            'memory_peak' => $memoryPeak,
            'memory_percentage' => $memoryPercentage,
        ];
    }

    protected function checkBotMetrics(): array
    {
        $concurrencyManager = app(ConcurrencyManager::class);
        $stats = $concurrencyManager->getStats();

        $status = 'healthy';
        if ($stats['utilization_percentage'] > 95) {
            $status = 'unhealthy';
        } elseif ($stats['utilization_percentage'] > 80) {
            $status = 'degraded';
        }

        return [
            'status' => $status,
            'active_conversations' => $stats['active_conversations'],
            'max_conversations' => $stats['max_conversations'],
            'utilization_percentage' => $stats['utilization_percentage'],
        ];
    }

    protected function formatHealthMessage(array $health): string
    {
        $overallStatus = $this->calculateOverallStatus($health);
        $statusIcon = match ($overallStatus) {
            'healthy' => '✅',
            'degraded' => '⚠️',
            'unhealthy' => '❌',
        };

        $message = "{$statusIcon} *Estado General: ".ucfirst($overallStatus)."*\n\n";

        // Redis status
        $redisIcon = $this->getStatusIcon($health['redis']['status']);
        $message .= "{$redisIcon} *Redis:* {$health['redis']['message']}";
        if (isset($health['redis']['latency_ms'])) {
            $message .= " ({$health['redis']['latency_ms']}ms)";
        }
        $message .= "\n";

        // Database status
        $dbIcon = $this->getStatusIcon($health['database']['status']);
        $message .= "{$dbIcon} *Base de datos:* {$health['database']['message']}";
        if (isset($health['database']['latency_ms'])) {
            $message .= " ({$health['database']['latency_ms']}ms)";
        }
        $message .= "\n";

        // DeepSeek status
        $deepSeekIcon = $this->getStatusIcon($health['deepseek']['status']);
        $message .= "{$deepSeekIcon} *DeepSeek API:* {$health['deepseek']['message']}";
        if (isset($health['deepseek']['latency_ms'])) {
            $message .= " ({$health['deepseek']['latency_ms']}ms)";
        }
        $message .= "\n\n";

        // Circuit breakers
        $cbIcon = $this->getStatusIcon($health['circuit_breakers']['status']);
        $message .= "{$cbIcon} *Circuit Breakers:*\n";
        foreach ($health['circuit_breakers']['circuits'] as $name => $stats) {
            $stateIcon = match ($stats['state']) {
                'CLOSED' => '✅',
                'HALF_OPEN' => '⚠️',
                'OPEN' => '❌',
            };
            $message .= "  {$stateIcon} {$name}: {$stats['state']} ({$stats['failures']} fallos)\n";
        }
        $message .= "\n";

        // System resources
        $sysIcon = $this->getStatusIcon($health['system']['status']);
        $memoryMB = round($health['system']['memory_usage'] / 1024 / 1024, 1);
        $message .= "{$sysIcon} *Sistema:* {$memoryMB}MB memoria ({$health['system']['memory_percentage']}%)\n";

        // Bot metrics
        $botIcon = $this->getStatusIcon($health['bot']['status']);
        $message .= "{$botIcon} *Bot:* {$health['bot']['active_conversations']}/{$health['bot']['max_conversations']} conversaciones ({$health['bot']['utilization_percentage']}%)\n";

        return $message;
    }

    protected function calculateOverallStatus(array $health): string
    {
        $statuses = array_column($health, 'status');

        if (in_array('unhealthy', $statuses)) {
            return 'unhealthy';
        }

        if (in_array('degraded', $statuses)) {
            return 'degraded';
        }

        return 'healthy';
    }

    protected function getStatusIcon(string $status): string
    {
        return match ($status) {
            'healthy' => '✅',
            'degraded' => '⚠️',
            'unhealthy' => '❌',
            default => '❓',
        };
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

    protected function isAdmin(int $chatId): bool
    {
        $adminIds = config('telegram.admin_chat_ids', []);

        return in_array($chatId, $adminIds);
    }
}
