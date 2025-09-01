<?php

namespace App\Telegram\Commands;

use App\Models\User;
use Telegram\Bot\Commands\Command;
use Illuminate\Support\Facades\Log;

class NotificacionesCommand extends Command
{
    protected string $name = 'notificaciones';
    protected string $description = 'Configurar notificaciones y alertas';

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        $user = User::where('telegram_chat_id', $chatId)->first();

        if (!$user) {
            $this->replyWithMessage([
                'text' => "❌ Necesitas registrarte primero. Usa /start para comenzar."
            ]);
            return;
        }

        $preferences = $user->notification_preferences ?? [];
        
        // Display current settings
        $message = "🔔 **Configuración de Notificaciones**\n\n";
        $message .= "Estado actual de tus notificaciones:\n\n";
        
        // Get current settings with defaults
        $dailySummary = $preferences['daily_summary_enabled'] ?? true;
        $priceAlerts = $preferences['price_alerts_enabled'] ?? true;
        $recommendations = $preferences['recommendations_enabled'] ?? true;
        $summaryTime = $preferences['daily_summary_time'] ?? '07:00';
        $alertFrequency = $preferences['alert_frequency'] ?? 'instant';
        $recommendationFrequency = $preferences['recommendation_frequency'] ?? 'daily';
        
        // Create inline keyboard with toggle options
        $buttons = [
            [
                [
                    'text' => ($dailySummary ? '✅' : '⬜') . ' Resumen Diario (' . $summaryTime . ')',
                    'callback_data' => 'notif_toggle:daily_summary'
                ]
            ],
            [
                [
                    'text' => ($priceAlerts ? '✅' : '⬜') . ' Alertas de Precio',
                    'callback_data' => 'notif_toggle:price_alerts'
                ]
            ],
            [
                [
                    'text' => ($recommendations ? '✅' : '⬜') . ' Recomendaciones',
                    'callback_data' => 'notif_toggle:recommendations'
                ]
            ],
            [
                ['text' => '⏰ Cambiar hora resumen', 'callback_data' => 'notif_config:summary_time']
            ],
            [
                ['text' => '📊 Frecuencia de alertas', 'callback_data' => 'notif_config:alert_freq']
            ],
            [
                ['text' => '💡 Frecuencia recomendaciones', 'callback_data' => 'notif_config:rec_freq']
            ],
            [
                ['text' => '✅ Guardar', 'callback_data' => 'notif_save'],
                ['text' => '❌ Cancelar', 'callback_data' => 'notif_cancel']
            ]
        ];
        
        $keyboard = ['inline_keyboard' => $buttons];
        
        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    public function toggleNotification(int $chatId, User $user, string $type): void
    {
        $preferences = $user->notification_preferences ?? [];
        
        // Toggle the specific notification type
        switch ($type) {
            case 'daily_summary':
                $preferences['daily_summary_enabled'] = !($preferences['daily_summary_enabled'] ?? true);
                break;
            case 'price_alerts':
                $preferences['price_alerts_enabled'] = !($preferences['price_alerts_enabled'] ?? true);
                break;
            case 'recommendations':
                $preferences['recommendations_enabled'] = !($preferences['recommendations_enabled'] ?? true);
                break;
        }
        
        // Save preferences
        $user->notification_preferences = $preferences;
        $user->save();
        
        // Refresh the display
        $this->displayCurrentSettings($chatId, $user);
        
        Log::info('Notification preference toggled', [
            'user_id' => $user->id,
            'type' => $type,
            'enabled' => $preferences["{$type}_enabled"] ?? false
        ]);
    }

    public function configureSummaryTime(int $chatId, User $user): void
    {
        $message = "⏰ **Configurar Hora del Resumen Diario**\n\n";
        $message .= "Selecciona la hora para recibir tu resumen diario:\n";
        $message .= "(Hora de México - Ciudad de México)\n";
        
        $buttons = [
            [
                ['text' => '5:00 AM', 'callback_data' => 'notif_time:05:00'],
                ['text' => '6:00 AM', 'callback_data' => 'notif_time:06:00'],
                ['text' => '7:00 AM', 'callback_data' => 'notif_time:07:00']
            ],
            [
                ['text' => '8:00 AM', 'callback_data' => 'notif_time:08:00'],
                ['text' => '9:00 AM', 'callback_data' => 'notif_time:09:00'],
                ['text' => '10:00 AM', 'callback_data' => 'notif_time:10:00']
            ],
            [
                ['text' => '12:00 PM', 'callback_data' => 'notif_time:12:00'],
                ['text' => '6:00 PM', 'callback_data' => 'notif_time:18:00'],
                ['text' => '8:00 PM', 'callback_data' => 'notif_time:20:00']
            ],
            [
                ['text' => '⬅️ Regresar', 'callback_data' => 'notif_back']
            ]
        ];
        
        $keyboard = ['inline_keyboard' => $buttons];
        
        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    public function configureAlertFrequency(int $chatId, User $user): void
    {
        $message = "📊 **Configurar Frecuencia de Alertas**\n\n";
        $message .= "¿Con qué frecuencia quieres recibir alertas de precio?\n";
        
        $preferences = $user->notification_preferences ?? [];
        $current = $preferences['alert_frequency'] ?? 'instant';
        
        $buttons = [
            [
                [
                    'text' => ($current === 'instant' ? '✅' : '') . ' Instantáneas',
                    'callback_data' => 'notif_alert_freq:instant'
                ]
            ],
            [
                [
                    'text' => ($current === 'hourly' ? '✅' : '') . ' Cada hora',
                    'callback_data' => 'notif_alert_freq:hourly'
                ]
            ],
            [
                [
                    'text' => ($current === 'daily' ? '✅' : '') . ' Una vez al día',
                    'callback_data' => 'notif_alert_freq:daily'
                ]
            ],
            [
                [
                    'text' => ($current === 'weekly' ? '✅' : '') . ' Semanal',
                    'callback_data' => 'notif_alert_freq:weekly'
                ]
            ],
            [
                ['text' => '⬅️ Regresar', 'callback_data' => 'notif_back']
            ]
        ];
        
        $keyboard = ['inline_keyboard' => $buttons];
        
        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    public function configureRecommendationFrequency(int $chatId, User $user): void
    {
        $message = "💡 **Configurar Frecuencia de Recomendaciones**\n\n";
        $message .= "¿Con qué frecuencia quieres recibir recomendaciones?\n";
        
        $preferences = $user->notification_preferences ?? [];
        $current = $preferences['recommendation_frequency'] ?? 'daily';
        
        $buttons = [
            [
                [
                    'text' => ($current === 'daily' ? '✅' : '') . ' Diario',
                    'callback_data' => 'notif_rec_freq:daily'
                ]
            ],
            [
                [
                    'text' => ($current === 'weekly' ? '✅' : '') . ' Semanal',
                    'callback_data' => 'notif_rec_freq:weekly'
                ]
            ],
            [
                [
                    'text' => ($current === 'biweekly' ? '✅' : '') . ' Quincenal',
                    'callback_data' => 'notif_rec_freq:biweekly'
                ]
            ],
            [
                [
                    'text' => ($current === 'monthly' ? '✅' : '') . ' Mensual',
                    'callback_data' => 'notif_rec_freq:monthly'
                ]
            ],
            [
                ['text' => '⬅️ Regresar', 'callback_data' => 'notif_back']
            ]
        ];
        
        $keyboard = ['inline_keyboard' => $buttons];
        
        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    public function updateSummaryTime(int $chatId, User $user, string $time): void
    {
        $preferences = $user->notification_preferences ?? [];
        $preferences['daily_summary_time'] = $time;
        
        $user->notification_preferences = $preferences;
        $user->save();
        
        $this->replyWithMessage([
            'text' => "✅ Hora del resumen diario actualizada a: {$time}\n\nRecibirás tu resumen diario a esta hora."
        ]);
        
        // Return to main notification settings
        $this->displayCurrentSettings($chatId, $user);
    }

    public function updateAlertFrequency(int $chatId, User $user, string $frequency): void
    {
        $preferences = $user->notification_preferences ?? [];
        $preferences['alert_frequency'] = $frequency;
        
        $user->notification_preferences = $preferences;
        $user->save();
        
        $frequencyText = [
            'instant' => 'Instantáneas',
            'hourly' => 'Cada hora',
            'daily' => 'Una vez al día',
            'weekly' => 'Semanal'
        ][$frequency] ?? $frequency;
        
        $this->replyWithMessage([
            'text' => "✅ Frecuencia de alertas actualizada a: {$frequencyText}"
        ]);
        
        // Return to main notification settings
        $this->displayCurrentSettings($chatId, $user);
    }

    public function updateRecommendationFrequency(int $chatId, User $user, string $frequency): void
    {
        $preferences = $user->notification_preferences ?? [];
        $preferences['recommendation_frequency'] = $frequency;
        
        $user->notification_preferences = $preferences;
        $user->save();
        
        $frequencyText = [
            'daily' => 'Diario',
            'weekly' => 'Semanal',
            'biweekly' => 'Quincenal',
            'monthly' => 'Mensual'
        ][$frequency] ?? $frequency;
        
        $this->replyWithMessage([
            'text' => "✅ Frecuencia de recomendaciones actualizada a: {$frequencyText}"
        ]);
        
        // Return to main notification settings
        $this->displayCurrentSettings($chatId, $user);
    }

    private function displayCurrentSettings(int $chatId, User $user): void
    {
        $preferences = $user->notification_preferences ?? [];
        
        $dailySummary = $preferences['daily_summary_enabled'] ?? true;
        $priceAlerts = $preferences['price_alerts_enabled'] ?? true;
        $recommendations = $preferences['recommendations_enabled'] ?? true;
        $summaryTime = $preferences['daily_summary_time'] ?? '07:00';
        $alertFrequency = $preferences['alert_frequency'] ?? 'instant';
        $recommendationFrequency = $preferences['recommendation_frequency'] ?? 'daily';
        
        $message = "🔔 **Configuración de Notificaciones**\n\n";
        $message .= "📅 Resumen Diario: " . ($dailySummary ? "✅ Activado ({$summaryTime})" : "⬜ Desactivado") . "\n";
        $message .= "💰 Alertas de Precio: " . ($priceAlerts ? "✅ Activado" : "⬜ Desactivado") . "\n";
        $message .= "💡 Recomendaciones: " . ($recommendations ? "✅ Activado" : "⬜ Desactivado") . "\n\n";
        $message .= "📊 Frecuencia Alertas: " . ucfirst($alertFrequency) . "\n";
        $message .= "💡 Frecuencia Recomendaciones: " . ucfirst($recommendationFrequency) . "\n";
        
        $buttons = [
            [
                [
                    'text' => ($dailySummary ? '✅' : '⬜') . ' Resumen Diario',
                    'callback_data' => 'notif_toggle:daily_summary'
                ]
            ],
            [
                [
                    'text' => ($priceAlerts ? '✅' : '⬜') . ' Alertas de Precio',
                    'callback_data' => 'notif_toggle:price_alerts'
                ]
            ],
            [
                [
                    'text' => ($recommendations ? '✅' : '⬜') . ' Recomendaciones',
                    'callback_data' => 'notif_toggle:recommendations'
                ]
            ],
            [
                ['text' => '⏰ Cambiar hora', 'callback_data' => 'notif_config:summary_time'],
                ['text' => '📊 Frecuencias', 'callback_data' => 'notif_config:frequencies']
            ],
            [
                ['text' => '✅ Listo', 'callback_data' => 'notif_done']
            ]
        ];
        
        $keyboard = ['inline_keyboard' => $buttons];
        
        $this->getTelegram()->editMessageText([
            'chat_id' => $chatId,
            'message_id' => $this->getUpdate()->getCallbackQuery()->getMessage()->getMessageId(),
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard)
        ]);
    }

    public function saveSettings(int $chatId, User $user): void
    {
        $this->replyWithMessage([
            'text' => "✅ Configuración de notificaciones guardada.\n\nRecibirás notificaciones según tus preferencias configuradas."
        ]);
        
        Log::info('Notification settings saved', [
            'user_id' => $user->id,
            'preferences' => $user->notification_preferences
        ]);
    }
}