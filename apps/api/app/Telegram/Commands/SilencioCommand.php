<?php

namespace App\Telegram\Commands;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Commands\Command;

class SilencioCommand extends Command
{
    protected string $name = 'silencio';

    protected string $description = 'Pausar notificaciones temporalmente';

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        $user = User::where('telegram_chat_id', $chatId)->first();

        if (! $user) {
            $this->replyWithMessage([
                'text' => '❌ Necesitas registrarte primero. Usa /start para comenzar.',
            ]);

            return;
        }

        $arguments = trim($this->getArguments());

        if (empty($arguments)) {
            $this->showSilenceOptions($chatId, $user);

            return;
        }

        // Parse duration from arguments
        $this->setSilencePeriod($chatId, $user, $arguments);
    }

    private function showSilenceOptions(int $chatId, User $user): void
    {
        $preferences = $user->notification_preferences ?? [];

        // Check if currently in silence period
        if (isset($preferences['silence_until'])) {
            $silenceUntil = Carbon::parse($preferences['silence_until']);

            if ($silenceUntil->isFuture()) {
                $this->showCurrentSilenceStatus($chatId, $user, $silenceUntil);

                return;
            }
        }

        $message = "🔕 **Pausar Notificaciones**\n\n";
        $message .= "¿Por cuánto tiempo quieres pausar las notificaciones?\n\n";
        $message .= "Selecciona una opción o escribe tu propia duración:\n";
        $message .= "Ejemplos: `/silencio 2h`, `/silencio 3d`, `/silencio 1s`\n";

        $buttons = [
            [
                ['text' => '1 hora', 'callback_data' => 'silence:1h'],
                ['text' => '2 horas', 'callback_data' => 'silence:2h'],
                ['text' => '4 horas', 'callback_data' => 'silence:4h'],
            ],
            [
                ['text' => '8 horas', 'callback_data' => 'silence:8h'],
                ['text' => '12 horas', 'callback_data' => 'silence:12h'],
                ['text' => '24 horas', 'callback_data' => 'silence:24h'],
            ],
            [
                ['text' => '2 días', 'callback_data' => 'silence:2d'],
                ['text' => '3 días', 'callback_data' => 'silence:3d'],
                ['text' => '1 semana', 'callback_data' => 'silence:7d'],
            ],
            [
                ['text' => '❌ Cancelar', 'callback_data' => 'silence:cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    private function showCurrentSilenceStatus(int $chatId, User $user, Carbon $silenceUntil): void
    {
        $now = Carbon::now();
        $diff = $silenceUntil->diff($now);

        $message = "🔕 **Notificaciones en Silencio**\n\n";
        $message .= "Las notificaciones están pausadas hasta:\n";
        $message .= '📅 '.$silenceUntil->setTimezone('America/Mexico_City')->format('d/m/Y H:i')."\n\n";

        // Format remaining time
        $remaining = '';
        if ($diff->days > 0) {
            $remaining .= $diff->days.' día'.($diff->days > 1 ? 's' : '').' ';
        }
        if ($diff->h > 0) {
            $remaining .= $diff->h.' hora'.($diff->h > 1 ? 's' : '').' ';
        }
        if ($diff->i > 0 && $diff->days == 0) {
            $remaining .= $diff->i.' minuto'.($diff->i > 1 ? 's' : '');
        }

        if ($remaining) {
            $message .= '⏱️ Tiempo restante: '.trim($remaining)."\n";
        }

        $message .= "\n¿Qué deseas hacer?";

        $buttons = [
            [
                ['text' => '🔔 Reactivar notificaciones', 'callback_data' => 'silence:cancel_silence'],
            ],
            [
                ['text' => '➕ Extender silencio', 'callback_data' => 'silence:extend'],
            ],
            [
                ['text' => '❌ Cancelar', 'callback_data' => 'silence:close'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function setSilencePeriod(int $chatId, User $user, string $duration): void
    {
        // Parse duration string
        $parsedDuration = $this->parseDuration($duration);

        if (! $parsedDuration) {
            $this->replyWithMessage([
                'text' => "❌ Formato de duración inválido.\n\nUsa formatos como: 2h (horas), 3d (días), 1s (semana)\n\nEjemplos: `/silencio 4h`, `/silencio 2d`",
                'parse_mode' => 'Markdown',
            ]);

            return;
        }

        // Calculate silence until time
        $silenceUntil = Carbon::now()->add($parsedDuration['unit'], $parsedDuration['value']);

        // Validate maximum silence period (30 days)
        $maxSilence = Carbon::now()->addDays(30);
        if ($silenceUntil->greaterThan($maxSilence)) {
            $this->replyWithMessage([
                'text' => '❌ El período máximo de silencio es de 30 días.',
            ]);

            return;
        }

        // Save silence period
        $preferences = $user->notification_preferences ?? [];
        $preferences['silence_until'] = $silenceUntil->toIso8601String();
        $user->notification_preferences = $preferences;
        $user->save();

        // Send confirmation
        $message = "🔕 **Notificaciones Pausadas**\n\n";
        $message .= "Las notificaciones han sido pausadas hasta:\n";
        $message .= '📅 '.$silenceUntil->setTimezone('America/Mexico_City')->format('d/m/Y H:i')."\n\n";

        $durationText = $this->formatDuration($parsedDuration);
        $message .= "⏱️ Duración: {$durationText}\n\n";

        $message .= "Para reactivarlas antes, usa `/silencio` y selecciona 'Reactivar notificaciones'.";

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        Log::info('Notifications silenced', [
            'user_id' => $user->id,
            'until' => $silenceUntil->toIso8601String(),
            'duration' => $duration,
        ]);
    }

    public function cancelSilence(int $chatId, User $user): void
    {
        $preferences = $user->notification_preferences ?? [];

        // Remove silence period
        unset($preferences['silence_until']);
        $user->notification_preferences = $preferences;
        $user->save();

        $message = "🔔 **Notificaciones Reactivadas**\n\n";
        $message .= "Las notificaciones han sido reactivadas.\n";
        $message .= "Recibirás alertas según tus preferencias configuradas.\n\n";
        $message .= 'Para configurar tus notificaciones usa /notificaciones';

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        Log::info('Notifications silence cancelled', [
            'user_id' => $user->id,
        ]);
    }

    public function extendSilence(int $chatId, User $user): void
    {
        $preferences = $user->notification_preferences ?? [];

        if (! isset($preferences['silence_until'])) {
            $this->showSilenceOptions($chatId, $user);

            return;
        }

        $currentSilenceUntil = Carbon::parse($preferences['silence_until']);

        $message = "➕ **Extender Período de Silencio**\n\n";
        $message .= "Silencio actual hasta:\n";
        $message .= '📅 '.$currentSilenceUntil->setTimezone('America/Mexico_City')->format('d/m/Y H:i')."\n\n";
        $message .= '¿Cuánto tiempo adicional quieres agregar?';

        $buttons = [
            [
                ['text' => '+1 hora', 'callback_data' => 'silence_extend:1h'],
                ['text' => '+2 horas', 'callback_data' => 'silence_extend:2h'],
                ['text' => '+4 horas', 'callback_data' => 'silence_extend:4h'],
            ],
            [
                ['text' => '+8 horas', 'callback_data' => 'silence_extend:8h'],
                ['text' => '+12 horas', 'callback_data' => 'silence_extend:12h'],
                ['text' => '+24 horas', 'callback_data' => 'silence_extend:24h'],
            ],
            [
                ['text' => '+2 días', 'callback_data' => 'silence_extend:2d'],
                ['text' => '+3 días', 'callback_data' => 'silence_extend:3d'],
                ['text' => '+1 semana', 'callback_data' => 'silence_extend:7d'],
            ],
            [
                ['text' => '❌ Cancelar', 'callback_data' => 'silence:cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function processSilenceExtension(int $chatId, User $user, string $duration): void
    {
        $preferences = $user->notification_preferences ?? [];

        if (! isset($preferences['silence_until'])) {
            $this->setSilencePeriod($chatId, $user, $duration);

            return;
        }

        $currentSilenceUntil = Carbon::parse($preferences['silence_until']);

        // Parse duration
        $parsedDuration = $this->parseDuration($duration);

        if (! $parsedDuration) {
            $this->replyWithMessage([
                'text' => '❌ Error al procesar la duración.',
            ]);

            return;
        }

        // Extend silence period
        $newSilenceUntil = $currentSilenceUntil->add($parsedDuration['unit'], $parsedDuration['value']);

        // Validate maximum silence period (30 days from now)
        $maxSilence = Carbon::now()->addDays(30);
        if ($newSilenceUntil->greaterThan($maxSilence)) {
            $this->replyWithMessage([
                'text' => '❌ El período máximo de silencio es de 30 días desde ahora.',
            ]);

            return;
        }

        // Save extended silence period
        $preferences['silence_until'] = $newSilenceUntil->toIso8601String();
        $user->notification_preferences = $preferences;
        $user->save();

        // Send confirmation
        $message = "🔕 **Silencio Extendido**\n\n";
        $message .= "Las notificaciones ahora están pausadas hasta:\n";
        $message .= '📅 '.$newSilenceUntil->setTimezone('America/Mexico_City')->format('d/m/Y H:i')."\n\n";

        $durationText = $this->formatDuration($parsedDuration);
        $message .= "➕ Tiempo agregado: {$durationText}";

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        Log::info('Notifications silence extended', [
            'user_id' => $user->id,
            'until' => $newSilenceUntil->toIso8601String(),
            'extension' => $duration,
        ]);
    }

    private function parseDuration(string $duration): ?array
    {
        // Remove spaces and convert to lowercase
        $duration = strtolower(trim($duration));

        // Match patterns like 2h, 3d, 1s (semana), 30m
        if (preg_match('/^(\d+)([hdsmw])$/', $duration, $matches)) {
            $value = (int) $matches[1];
            $unit = $matches[2];

            switch ($unit) {
                case 'h':
                    return ['value' => $value, 'unit' => 'hours', 'text' => 'hora'];
                case 'd':
                    return ['value' => $value, 'unit' => 'days', 'text' => 'día'];
                case 's':
                case 'w':
                    return ['value' => $value, 'unit' => 'weeks', 'text' => 'semana'];
                case 'm':
                    return ['value' => $value, 'unit' => 'minutes', 'text' => 'minuto'];
                default:
                    return null;
            }
        }

        return null;
    }

    private function formatDuration(array $parsedDuration): string
    {
        $value = $parsedDuration['value'];
        $text = $parsedDuration['text'];

        if ($value == 1) {
            return "1 {$text}";
        }

        // Pluralize
        switch ($text) {
            case 'hora':
                return "{$value} horas";
            case 'día':
                return "{$value} días";
            case 'semana':
                return "{$value} semanas";
            case 'minuto':
                return "{$value} minutos";
            default:
                return "{$value} {$text}s";
        }
    }
}
