<?php

namespace App\Telegram\Commands\Admin;

use App\Models\TelegramUser;
use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\SessionManager;
use App\Telegram\Commands\BaseCommand;
use Illuminate\Support\Facades\DB;

class StatsCommand extends BaseCommand
{
    protected $name = 'admin_stats';

    protected $description = 'Mostrar estadísticas de usuarios y uso del bot (Solo admin)';

    protected SessionManager $sessionManager;

    protected ConcurrencyManager $concurrencyManager;

    public function __construct()
    {
        $this->sessionManager = app(SessionManager::class);
        $this->concurrencyManager = app(ConcurrencyManager::class);
    }

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
            $stats = $this->gatherUserStats();
            $message = $this->formatStatsMessage($stats);

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => '❌ Error al obtener estadísticas: '.$e->getMessage(),
            ]);
        }
    }

    protected function gatherUserStats(): array
    {
        // User statistics
        $totalUsers = TelegramUser::count();
        $activeUsersToday = TelegramUser::whereDate('last_activity_at', today())->count();
        $activeUsersWeek = TelegramUser::where('last_activity_at', '>=', now()->subWeek())->count();
        $newUsersToday = TelegramUser::whereDate('created_at', today())->count();

        // Session statistics
        $sessionMetrics = $this->sessionManager->getSessionMetrics();

        // Concurrency statistics
        $concurrencyStats = $this->concurrencyManager->getStats();
        $queueStats = $this->concurrencyManager->getQueueStats();

        // Command usage statistics (last 24 hours)
        $commandStats = $this->getCommandUsageStats();

        // Database query statistics
        $dbStats = $this->getDatabaseStats();

        return [
            'users' => [
                'total' => $totalUsers,
                'active_today' => $activeUsersToday,
                'active_week' => $activeUsersWeek,
                'new_today' => $newUsersToday,
            ],
            'sessions' => $sessionMetrics,
            'concurrency' => $concurrencyStats,
            'queue' => $queueStats,
            'commands' => $commandStats,
            'database' => $dbStats,
        ];
    }

    protected function formatStatsMessage(array $stats): string
    {
        $message = "📊 *Estadísticas del Bot FuelIntel*\n\n";

        // User stats
        $message .= "👥 *Usuarios:*\n";
        $message .= "• Total: {$stats['users']['total']}\n";
        $message .= "• Activos hoy: {$stats['users']['active_today']}\n";
        $message .= "• Activos esta semana: {$stats['users']['active_week']}\n";
        $message .= "• Nuevos hoy: {$stats['users']['new_today']}\n\n";

        // Session stats
        $message .= "💾 *Sesiones:*\n";
        $message .= "• Activas: {$stats['sessions']['total_sessions']}\n";
        $message .= "• TTL promedio: {$stats['sessions']['average_ttl_seconds']}s\n";
        $message .= '• Tamaño total: '.$this->formatBytes($stats['sessions']['total_size_bytes'])."\n";
        $message .= '• Compresión: '.($stats['sessions']['compression_enabled'] ? '✅' : '❌')."\n\n";

        // Concurrency stats
        $message .= "⚡ *Concurrencia:*\n";
        $message .= "• Conversaciones activas: {$stats['concurrency']['active_conversations']}\n";
        $message .= "• Utilización: {$stats['concurrency']['utilization_percentage']}%\n";
        $message .= '• Bajo presión: '.($stats['concurrency']['under_backpressure'] ? '⚠️ Sí' : '✅ No')."\n";
        $message .= "• Cola: {$stats['queue']['queue_length']} solicitudes\n\n";

        // Command usage stats
        if (! empty($stats['commands'])) {
            $message .= "🎯 *Comandos más usados (24h):*\n";
            foreach (array_slice($stats['commands'], 0, 5) as $command => $count) {
                $message .= "• /{$command}: {$count} usos\n";
            }
            $message .= "\n";
        }

        // Database stats
        $message .= "🗄️ *Base de datos:*\n";
        $message .= "• Consultas/minuto: {$stats['database']['queries_per_minute']}\n";
        $message .= "• Tiempo promedio: {$stats['database']['avg_query_time']}ms\n";

        $message .= "\n🕐 Actualizado: ".now()->format('d/m/Y H:i:s');

        return $message;
    }

    protected function getCommandUsageStats(): array
    {
        try {
            // Get command usage from logs (this would be better with a dedicated metrics table)
            $results = DB::table('telescope_entries')
                ->where('type', 'log')
                ->where('content->message', 'LIKE', '%Telegram command executed%')
                ->where('created_at', '>=', now()->subDay())
                ->get();

            $commandCounts = [];

            foreach ($results as $entry) {
                $content = json_decode($entry->content, true);
                if (isset($content['extra']['command'])) {
                    $command = $content['extra']['command'];
                    $commandCounts[$command] = ($commandCounts[$command] ?? 0) + 1;
                }
            }

            arsort($commandCounts);

            return $commandCounts;
        } catch (\Exception $e) {
            Log::error('Failed to get command usage stats: '.$e->getMessage());

            return [];
        }
    }

    protected function getDatabaseStats(): array
    {
        try {
            // Calculate queries per minute from recent activity
            $recentQueries = DB::table('telescope_entries')
                ->where('type', 'query')
                ->where('created_at', '>=', now()->subMinutes(5))
                ->count();

            $queriesPerMinute = round($recentQueries / 5);

            // Get average query time
            $avgQueryTime = DB::table('telescope_entries')
                ->where('type', 'query')
                ->where('created_at', '>=', now()->subHour())
                ->avg(DB::raw('CAST(JSON_EXTRACT(content, "$.time") AS DECIMAL(10,2))')) ?? 0;

            return [
                'queries_per_minute' => $queriesPerMinute,
                'avg_query_time' => round($avgQueryTime, 2),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get database stats: '.$e->getMessage());

            return [
                'queries_per_minute' => 0,
                'avg_query_time' => 0,
            ];
        }
    }

    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $unitIndex = 0;

        while ($bytes >= 1024 && $unitIndex < count($units) - 1) {
            $bytes /= 1024;
            $unitIndex++;
        }

        return round($bytes, 2).' '.$units[$unitIndex];
    }

    protected function isAdmin(int $chatId): bool
    {
        $adminIds = config('telegram.admin_chat_ids', []);

        return in_array($chatId, $adminIds);
    }
}
