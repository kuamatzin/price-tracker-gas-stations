<?php

namespace App\Telegram\Commands\Admin;

use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\SessionManager;
use App\Telegram\Commands\BaseCommand;

class SessionsCommand extends BaseCommand
{
    protected $name = 'admin_sessions';

    protected $description = 'Administrar sesiones activas (Solo admin)';

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
            $sessionData = $this->gatherSessionData();
            $message = $this->formatSessionMessage($sessionData);
            $keyboard = $this->buildSessionManagementKeyboard();

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
                'reply_markup' => json_encode([
                    'inline_keyboard' => $keyboard,
                ]),
            ]);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => '❌ Error al obtener información de sesiones: '.$e->getMessage(),
            ]);
        }
    }

    protected function gatherSessionData(): array
    {
        // Session metrics
        $sessionMetrics = $this->sessionManager->getSessionMetrics();

        // Concurrency stats
        $concurrencyStats = $this->concurrencyManager->getStats();
        $queueStats = $this->concurrencyManager->getQueueStats();

        // Active sessions details
        $activeSessions = $this->sessionManager->getActiveSessions();

        // Session analysis
        $sessionAnalysis = $this->analyzeActiveSessions($activeSessions);

        return [
            'metrics' => $sessionMetrics,
            'concurrency' => $concurrencyStats,
            'queue' => $queueStats,
            'active_sessions' => $activeSessions,
            'analysis' => $sessionAnalysis,
        ];
    }

    protected function analyzeActiveSessions(array $sessions): array
    {
        $analysis = [
            'by_state' => [],
            'avg_duration' => 0,
            'longest_session' => 0,
            'inactive_sessions' => 0,
        ];

        $totalDuration = 0;
        $now = time();

        foreach ($sessions as $session) {
            $state = $session['state'] ?? 'idle';
            $analysis['by_state'][$state] = ($analysis['by_state'][$state] ?? 0) + 1;

            $startTime = $session['created_at'] ?? $now;
            $duration = $now - $startTime;
            $totalDuration += $duration;

            if ($duration > $analysis['longest_session']) {
                $analysis['longest_session'] = $duration;
            }

            // Check for inactive sessions (no activity in 10 minutes)
            $lastActivity = $session['last_activity'] ?? $startTime;
            if (($now - $lastActivity) > 600) {
                $analysis['inactive_sessions']++;
            }
        }

        if (count($sessions) > 0) {
            $analysis['avg_duration'] = round($totalDuration / count($sessions));
        }

        return $analysis;
    }

    protected function formatSessionMessage(array $data): string
    {
        $message = "💾 *Administración de Sesiones*\n\n";

        // Overview
        $message .= "📊 *Resumen:*\n";
        $message .= "• Sesiones activas: {$data['metrics']['total_sessions']}\n";
        $message .= "• TTL promedio: {$data['metrics']['average_ttl_seconds']}s\n";
        $message .= '• Tamaño total: '.$this->formatBytes($data['metrics']['total_size_bytes'])."\n";
        $message .= '• Compresión: '.($data['metrics']['compression_enabled'] ? '✅ Activa' : '❌ Inactiva')."\n\n";

        // Concurrency info
        $message .= "⚡ *Concurrencia:*\n";
        $message .= "• Conversaciones: {$data['concurrency']['active_conversations']}/{$data['concurrency']['max_conversations']}\n";
        $message .= "• Utilización: {$data['concurrency']['utilization_percentage']}%\n";
        $message .= '• Bajo presión: '.($data['concurrency']['under_backpressure'] ? '⚠️ Sí' : '✅ No')."\n";

        // Queue info
        if ($data['queue']['queue_length'] > 0) {
            $message .= "• Cola: {$data['queue']['queue_length']} solicitudes\n";
            $oldestAge = round($data['queue']['oldest_request_age'] / 60, 1);
            $message .= "• Más antigua: {$oldestAge} min\n";
        }
        $message .= "\n";

        // Session analysis
        if (! empty($data['analysis']['by_state'])) {
            $message .= "📈 *Análisis de sesiones:*\n";
            foreach ($data['analysis']['by_state'] as $state => $count) {
                $message .= '• '.ucfirst($state).": {$count}\n";
            }

            $avgDurationMin = round($data['analysis']['avg_duration'] / 60, 1);
            $longestMin = round($data['analysis']['longest_session'] / 60, 1);

            $message .= "• Duración promedio: {$avgDurationMin} min\n";
            $message .= "• Sesión más larga: {$longestMin} min\n";

            if ($data['analysis']['inactive_sessions'] > 0) {
                $message .= "• Sesiones inactivas: {$data['analysis']['inactive_sessions']}\n";
            }
            $message .= "\n";
        }

        $message .= '🕐 Actualizado: '.now()->format('d/m/Y H:i:s');

        return $message;
    }

    protected function buildSessionManagementKeyboard(): array
    {
        return [
            [
                [
                    'text' => '🧹 Limpiar Expiradas',
                    'callback_data' => 'admin:sessions:cleanup',
                ],
                [
                    'text' => '⚡ Procesar Cola',
                    'callback_data' => 'admin:sessions:process_queue',
                ],
            ],
            [
                [
                    'text' => '📊 Métricas Detalladas',
                    'callback_data' => 'admin:sessions:detailed_metrics',
                ],
            ],
            [
                [
                    'text' => '🔄 Actualizar',
                    'callback_data' => 'admin:sessions:refresh',
                ],
            ],
        ];
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
