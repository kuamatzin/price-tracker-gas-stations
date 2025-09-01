<?php

namespace App\Telegram\Commands\Admin;

use App\Services\Telegram\CircuitBreaker;
use App\Services\Telegram\ConcurrencyManager;
use App\Services\Telegram\SessionManager;
use App\Telegram\Commands\BaseCommand;
use Illuminate\Support\Facades\Cache;

class ClearCacheCommand extends BaseCommand
{
    protected $name = 'admin_cache';

    protected $description = 'Administrar caché del sistema (Solo admin)';

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

        // Parse arguments to determine what to clear
        $arguments = $this->getArguments();

        if (! $arguments) {
            $this->showCacheOptions();

            return;
        }

        $this->executeCacheOperation($arguments);
    }

    protected function showCacheOptions(): void
    {
        $message = "🗂️ *Administración de Caché*\n\n";
        $message .= "Selecciona qué caché administrar:\n\n";
        $message .= "• `sessions` - Limpiar sesiones expiradas\n";
        $message .= "• `circuits` - Resetear circuit breakers\n";
        $message .= "• `app` - Limpiar caché de aplicación\n";
        $message .= "• `all` - Limpiar todo\n\n";
        $message .= 'Ejemplo: `/admin_cache sessions`';

        $keyboard = [
            [
                ['text' => '💾 Sessions', 'callback_data' => 'admin:cache:sessions'],
                ['text' => '⚡ Circuits', 'callback_data' => 'admin:cache:circuits'],
            ],
            [
                ['text' => '📱 App Cache', 'callback_data' => 'admin:cache:app'],
                ['text' => '🧹 Todo', 'callback_data' => 'admin:cache:all'],
            ],
        ];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode([
                'inline_keyboard' => $keyboard,
            ]),
        ]);
    }

    protected function executeCacheOperation(string $operation): void
    {
        $results = [];

        switch ($operation) {
            case 'sessions':
                $results['sessions'] = $this->clearSessions();
                break;

            case 'circuits':
                $results['circuits'] = $this->resetCircuitBreakers();
                break;

            case 'app':
                $results['app'] = $this->clearAppCache();
                break;

            case 'all':
                $results['sessions'] = $this->clearSessions();
                $results['circuits'] = $this->resetCircuitBreakers();
                $results['app'] = $this->clearAppCache();
                break;

            default:
                $this->replyWithMessage([
                    'text' => '❌ Operación no válida. Usa: sessions, circuits, app, o all',
                ]);

                return;
        }

        $message = $this->formatClearResults($results);
        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);
    }

    protected function clearSessions(): array
    {
        try {
            $sessionManager = app(SessionManager::class);
            $concurrencyManager = app(ConcurrencyManager::class);

            // Clean expired sessions
            $expiredCleaned = $sessionManager->cleanupExpiredSessions();

            // Force cleanup of conversations
            $conversationsCleaned = $concurrencyManager->forceCleanup();

            return [
                'success' => true,
                'expired_sessions' => $expiredCleaned,
                'conversations_cleared' => $conversationsCleaned,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    protected function resetCircuitBreakers(): array
    {
        try {
            $deepSeekBreaker = CircuitBreaker::createForDeepSeek();
            $laravelApiBreaker = CircuitBreaker::createForLaravelApi();

            $deepSeekBreaker->reset();
            $laravelApiBreaker->reset();

            return [
                'success' => true,
                'circuits_reset' => ['deepseek', 'laravel_api'],
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    protected function clearAppCache(): array
    {
        try {
            $clearedTags = [];

            // Clear specific cache tags
            $tags = ['telegram', 'prices', 'analytics', 'nlp'];

            foreach ($tags as $tag) {
                try {
                    Cache::tags($tag)->flush();
                    $clearedTags[] = $tag;
                } catch (\Exception $e) {
                    // Tag might not exist, ignore
                }
            }

            // Clear general cache
            Cache::flush();

            return [
                'success' => true,
                'cleared_tags' => $clearedTags,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    protected function formatClearResults(array $results): string
    {
        $message = "🧹 *Resultados de Limpieza*\n\n";

        foreach ($results as $operation => $result) {
            $icon = $result['success'] ? '✅' : '❌';
            $operationName = match ($operation) {
                'sessions' => 'Sesiones',
                'circuits' => 'Circuit Breakers',
                'app' => 'Caché de Aplicación',
            };

            $message .= "{$icon} *{$operationName}:*\n";

            if ($result['success']) {
                switch ($operation) {
                    case 'sessions':
                        $message .= "• Sesiones expiradas: {$result['expired_sessions']}\n";
                        $message .= "• Conversaciones limpiadas: {$result['conversations_cleared']}\n";
                        break;

                    case 'circuits':
                        $message .= '• Circuits resetados: '.implode(', ', $result['circuits_reset'])."\n";
                        break;

                    case 'app':
                        if (! empty($result['cleared_tags'])) {
                            $message .= '• Tags limpiados: '.implode(', ', $result['cleared_tags'])."\n";
                        }
                        $message .= "• Caché general limpiado\n";
                        break;
                }
            } else {
                $message .= "• Error: {$result['error']}\n";
            }

            $message .= "\n";
        }

        $message .= '🕐 Completado: '.now()->format('d/m/Y H:i:s');

        return $message;
    }

    protected function buildSessionManagementKeyboard(): array
    {
        return [
            [
                ['text' => '💾 Sessions', 'callback_data' => 'admin:clear:sessions'],
                ['text' => '⚡ Circuits', 'callback_data' => 'admin:clear:circuits'],
            ],
            [
                ['text' => '📱 App Cache', 'callback_data' => 'admin:clear:app'],
                ['text' => '🧹 Todo', 'callback_data' => 'admin:clear:all'],
            ],
            [
                ['text' => '🔄 Actualizar Estado', 'callback_data' => 'admin:sessions:refresh'],
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
