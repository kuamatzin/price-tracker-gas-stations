<?php

namespace App\Telegram\Commands\Admin;

use App\Services\Telegram\CircuitBreaker;
use App\Telegram\Commands\BaseCommand;

class CircuitStatusCommand extends BaseCommand
{
    protected $name = 'admin_circuits';

    protected $description = 'Mostrar estado de circuit breakers (Solo admin)';

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
            $circuits = $this->getCircuitStatus();
            $message = $this->formatCircuitMessage($circuits);

            // Add inline keyboard for circuit management
            $keyboard = $this->buildCircuitManagementKeyboard($circuits);

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
                'reply_markup' => json_encode([
                    'inline_keyboard' => $keyboard,
                ]),
            ]);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => '❌ Error al obtener estado de circuit breakers: '.$e->getMessage(),
            ]);
        }
    }

    protected function getCircuitStatus(): array
    {
        $deepSeekBreaker = CircuitBreaker::createForDeepSeek();
        $laravelApiBreaker = CircuitBreaker::createForLaravelApi();

        return [
            'deepseek' => $deepSeekBreaker->getStats(),
            'laravel_api' => $laravelApiBreaker->getStats(),
        ];
    }

    protected function formatCircuitMessage(array $circuits): string
    {
        $message = "⚡ *Estado de Circuit Breakers*\n\n";

        foreach ($circuits as $name => $stats) {
            $stateIcon = match ($stats['state']) {
                'CLOSED' => '✅',
                'HALF_OPEN' => '⚠️',
                'OPEN' => '❌',
            };

            $healthStatus = match ($stats['state']) {
                'CLOSED' => 'Operativo',
                'HALF_OPEN' => 'Recuperándose',
                'OPEN' => 'Fuera de servicio',
            };

            $message .= "{$stateIcon} *".ucfirst(str_replace('_', ' ', $name))."*\n";
            $message .= "• Estado: {$stats['state']} ({$healthStatus})\n";
            $message .= "• Fallos consecutivos: {$stats['failures']}/{$stats['failureThreshold']}\n";

            if ($stats['state'] === 'HALF_OPEN') {
                $message .= "• Éxitos en recuperación: {$stats['successes']}/{$stats['successThreshold']}\n";
            }

            if ($stats['lastFailureTime'] > 0) {
                $lastFailure = date('H:i:s', $stats['lastFailureTime'] / 1000);
                $message .= "• Último fallo: {$lastFailure}\n";
            }

            $message .= '• Puede intentar: '.($stats['canAttempt'] ? '✅ Sí' : '❌ No')."\n";
            $message .= '• Cooldown: '.round($stats['cooldownPeriod'] / 1000)."s\n\n";
        }

        $overallStatus = $this->calculateOverallCircuitHealth($circuits);
        $message .= '🔧 *Estado general:* '.ucfirst($overallStatus)."\n";

        $message .= "\n🕐 Actualizado: ".now()->format('d/m/Y H:i:s');

        return $message;
    }

    protected function buildCircuitManagementKeyboard(array $circuits): array
    {
        $keyboard = [];

        foreach ($circuits as $name => $stats) {
            $row = [];

            // Reset button
            $row[] = [
                'text' => "🔄 Reset {$name}",
                'callback_data' => "admin:circuit:reset:{$name}",
            ];

            // Force open/close based on current state
            if ($stats['state'] === 'OPEN') {
                $row[] = [
                    'text' => "🔓 Force Close {$name}",
                    'callback_data' => "admin:circuit:force_close:{$name}",
                ];
            } else {
                $row[] = [
                    'text' => "🔒 Force Open {$name}",
                    'callback_data' => "admin:circuit:force_open:{$name}",
                ];
            }

            $keyboard[] = $row;
        }

        // Refresh button
        $keyboard[] = [
            [
                'text' => '🔄 Actualizar Estado',
                'callback_data' => 'admin:circuit:refresh',
            ],
        ];

        return $keyboard;
    }

    protected function calculateOverallCircuitHealth(array $circuits): string
    {
        $unhealthyCount = 0;
        $degradedCount = 0;

        foreach ($circuits as $stats) {
            if ($stats['state'] === 'OPEN') {
                $unhealthyCount++;
            } elseif ($stats['state'] === 'HALF_OPEN') {
                $degradedCount++;
            }
        }

        if ($unhealthyCount > 0) {
            return 'crítico';
        } elseif ($degradedCount > 0) {
            return 'degradado';
        }

        return 'saludable';
    }

    protected function isAdmin(int $chatId): bool
    {
        $adminIds = config('telegram.admin_chat_ids', []);

        return in_array($chatId, $adminIds);
    }
}
