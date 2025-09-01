<?php

namespace App\Telegram\Commands;

use App\Models\Station;
use App\Models\User;
use App\Services\Telegram\InlineKeyboardBuilder;
use App\Services\Telegram\SessionManager;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Commands\Command;

class ConfigurarCommand extends Command
{
    protected string $name = 'configurar';

    protected string $description = 'Configurar preferencias y alertas';

    private SessionManager $sessionManager;

    private InlineKeyboardBuilder $keyboardBuilder;

    public function __construct(
        SessionManager $sessionManager,
        InlineKeyboardBuilder $keyboardBuilder
    ) {
        $this->sessionManager = $sessionManager;
        $this->keyboardBuilder = $keyboardBuilder;
    }

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

        // Get or create session
        $session = $this->sessionManager->getSession($user->id);

        // Initialize wizard state
        $session->setState('configurar:step1');
        $session->setStateData([
            'wizard' => 'configurar',
            'step' => 1,
            'data' => [],
            'started_at' => time(),
        ]);

        $this->sessionManager->saveSession($session);

        // Start wizard with step 1
        $this->showStep1($chatId, $user);
    }

    private function showStep1(int $chatId, User $user): void
    {
        // Get user's registered stations
        $stations = $user->stations()->get();

        $message = "📍 **Configuración de Preferencias**\n\n";
        $message .= "Paso 1/5: ¿Cuál es tu estación principal?\n\n";

        if ($stations->isEmpty()) {
            $message .= "No tienes estaciones registradas.\n";
            $message .= 'Usa /registrar para agregar una estación primero.';

            $this->replyWithMessage([
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            // Clear wizard state
            $session = $this->sessionManager->getSession($user->id);
            $session->clearState();
            $this->sessionManager->saveSession($session);

            return;
        }

        // Create inline keyboard with stations
        $buttons = [];
        foreach ($stations as $station) {
            $alias = $station->pivot->alias ?? $station->nombre;
            $buttons[] = [
                'text' => $alias,
                'callback_data' => "config_station:{$station->numero}",
            ];
        }

        // Add option to add new station
        $buttons[] = [
            'text' => '➕ Agregar nueva estación',
            'callback_data' => 'config_add_station',
        ];

        // Add cancel button
        $buttons[] = [
            'text' => '❌ Cancelar',
            'callback_data' => 'config_cancel',
        ];

        $keyboard = [
            'inline_keyboard' => array_chunk($buttons, 2),
        ];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function handleStep2(int $chatId, User $user, string $stationId): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['station_id'] = $stationId;
        $stateData['step'] = 2;

        $session->setState('configurar:step2');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        $message = "📏 **Configuración de Preferencias**\n\n";
        $message .= "Paso 2/5: ¿Radio de monitoreo en kilómetros?\n";
        $message .= "Esto determina qué tan lejos buscaremos estaciones para comparar precios.\n";

        // Create radius options
        $buttons = [
            [
                ['text' => '1 km', 'callback_data' => 'config_radius:1'],
                ['text' => '3 km', 'callback_data' => 'config_radius:3'],
            ],
            [
                ['text' => '5 km', 'callback_data' => 'config_radius:5'],
                ['text' => '10 km', 'callback_data' => 'config_radius:10'],
            ],
            [
                ['text' => '15 km', 'callback_data' => 'config_radius:15'],
                ['text' => '20 km', 'callback_data' => 'config_radius:20'],
            ],
            [
                ['text' => '⬅️ Atrás', 'callback_data' => 'config_back:1'],
                ['text' => '❌ Cancelar', 'callback_data' => 'config_cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function handleStep3(int $chatId, User $user, int $radius): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['radius_km'] = $radius;
        $stateData['step'] = 3;

        $session->setState('configurar:step3');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        $message = "🎯 **Configuración de Preferencias**\n\n";
        $message .= "Paso 3/5: ¿Umbral de alerta de precios?\n";
        $message .= "Te notificaremos cuando los precios cambien más de este porcentaje.\n";

        // Create threshold options
        $buttons = [
            [
                ['text' => '1%', 'callback_data' => 'config_threshold:1'],
                ['text' => '2%', 'callback_data' => 'config_threshold:2'],
            ],
            [
                ['text' => '3%', 'callback_data' => 'config_threshold:3'],
                ['text' => '5%', 'callback_data' => 'config_threshold:5'],
            ],
            [
                ['text' => '10%', 'callback_data' => 'config_threshold:10'],
                ['text' => 'Sin alertas', 'callback_data' => 'config_threshold:0'],
            ],
            [
                ['text' => '⬅️ Atrás', 'callback_data' => 'config_back:2'],
                ['text' => '❌ Cancelar', 'callback_data' => 'config_cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function handleStep4(int $chatId, User $user, float $threshold): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['data']['price_change_threshold'] = $threshold;
        $stateData['step'] = 4;

        $session->setState('configurar:step4');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        $message = "⛽ **Configuración de Preferencias**\n\n";
        $message .= "Paso 4/5: ¿Qué tipos de combustible quieres monitorear?\n";
        $message .= "Selecciona todos los que te interesen.\n";

        // Initialize fuel types if not set
        if (! isset($stateData['data']['fuel_types'])) {
            $stateData['data']['fuel_types'] = ['regular', 'premium', 'diesel'];
            $session->setStateData($stateData);
            $this->sessionManager->saveSession($session);
        }

        $fuelTypes = $stateData['data']['fuel_types'] ?? ['regular', 'premium', 'diesel'];

        // Create fuel type toggle buttons
        $buttons = [
            [
                [
                    'text' => (in_array('regular', $fuelTypes) ? '✅' : '⬜').' Regular',
                    'callback_data' => 'config_fuel:regular',
                ],
            ],
            [
                [
                    'text' => (in_array('premium', $fuelTypes) ? '✅' : '⬜').' Premium',
                    'callback_data' => 'config_fuel:premium',
                ],
            ],
            [
                [
                    'text' => (in_array('diesel', $fuelTypes) ? '✅' : '⬜').' Diesel',
                    'callback_data' => 'config_fuel:diesel',
                ],
            ],
            [
                ['text' => '✅ Continuar', 'callback_data' => 'config_fuel_done'],
            ],
            [
                ['text' => '⬅️ Atrás', 'callback_data' => 'config_back:3'],
                ['text' => '❌ Cancelar', 'callback_data' => 'config_cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function handleStep5(int $chatId, User $user): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();
        $stateData['step'] = 5;

        $session->setState('configurar:step5');
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        $message = "⏰ **Configuración de Preferencias**\n\n";
        $message .= "Paso 5/5: ¿A qué hora quieres recibir el resumen diario?\n";
        $message .= "Hora de México (Ciudad de México)\n";

        // Create time options
        $buttons = [
            [
                ['text' => '6:00 AM', 'callback_data' => 'config_time:06:00'],
                ['text' => '7:00 AM', 'callback_data' => 'config_time:07:00'],
            ],
            [
                ['text' => '8:00 AM', 'callback_data' => 'config_time:08:00'],
                ['text' => '9:00 AM', 'callback_data' => 'config_time:09:00'],
            ],
            [
                ['text' => '12:00 PM', 'callback_data' => 'config_time:12:00'],
                ['text' => '6:00 PM', 'callback_data' => 'config_time:18:00'],
            ],
            [
                ['text' => '8:00 PM', 'callback_data' => 'config_time:20:00'],
                ['text' => 'Sin resumen', 'callback_data' => 'config_time:none'],
            ],
            [
                ['text' => '⬅️ Atrás', 'callback_data' => 'config_back:4'],
                ['text' => '❌ Cancelar', 'callback_data' => 'config_cancel'],
            ],
        ];

        $keyboard = ['inline_keyboard' => $buttons];

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
            'reply_markup' => json_encode($keyboard),
        ]);
    }

    public function completeConfiguration(int $chatId, User $user, ?string $summaryTime): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();

        // Get configuration data
        $configData = $stateData['data'] ?? [];

        if ($summaryTime && $summaryTime !== 'none') {
            $configData['daily_summary_time'] = $summaryTime;
        }

        // Prepare notification preferences
        $preferences = $user->notification_preferences ?? [];
        $preferences['alert_radius_km'] = $configData['radius_km'] ?? 5;
        $preferences['price_change_threshold'] = $configData['price_change_threshold'] ?? 2;
        $preferences['fuel_types'] = $configData['fuel_types'] ?? ['regular', 'premium', 'diesel'];
        $preferences['daily_summary_time'] = $configData['daily_summary_time'] ?? null;
        $preferences['telegram_enabled'] = true;
        $preferences['primary_station_id'] = $configData['station_id'] ?? null;

        // Save preferences
        $user->notification_preferences = $preferences;
        $user->save();

        // Clear session state
        $session->clearState();
        $this->sessionManager->saveSession($session);

        // Send confirmation message
        $station = Station::find($preferences['primary_station_id']);
        $stationName = $station ? $station->nombre : 'No seleccionada';

        $message = "✅ **Configuración Guardada**\n\n";
        $message .= "📍 Estación principal: {$stationName}\n";
        $message .= "📏 Radio de monitoreo: {$preferences['alert_radius_km']} km\n";
        $message .= '🎯 Umbral de alerta: '.($preferences['price_change_threshold'] > 0 ? "{$preferences['price_change_threshold']}%" : 'Sin alertas')."\n";
        $message .= '⛽ Combustibles: '.implode(', ', array_map('ucfirst', $preferences['fuel_types']))."\n";
        $message .= '⏰ Resumen diario: '.($preferences['daily_summary_time'] ?? 'Desactivado')."\n\n";
        $message .= 'Puedes cambiar estas preferencias en cualquier momento usando /configurar';

        $this->replyWithMessage([
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);

        Log::info('User preferences configured', [
            'user_id' => $user->id,
            'preferences' => $preferences,
        ]);
    }

    public function handleCancel(int $chatId, User $user): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $session->clearState();
        $this->sessionManager->saveSession($session);

        $this->replyWithMessage([
            'text' => "❌ Configuración cancelada.\n\nPuedes reiniciar la configuración en cualquier momento usando /configurar",
        ]);
    }

    public function handleBack(int $chatId, User $user, int $fromStep): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();

        // Go back to previous step
        $previousStep = max(1, $fromStep - 1);
        $stateData['step'] = $previousStep;
        $session->setState("configurar:step{$previousStep}");
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        // Show previous step
        switch ($previousStep) {
            case 1:
                $this->showStep1($chatId, $user);
                break;
            case 2:
                $this->handleStep2($chatId, $user, $stateData['data']['station_id'] ?? '');
                break;
            case 3:
                $this->handleStep3($chatId, $user, $stateData['data']['radius_km'] ?? 5);
                break;
            case 4:
                $this->handleStep4($chatId, $user, $stateData['data']['price_change_threshold'] ?? 2);
                break;
        }
    }

    public function toggleFuelType(int $chatId, User $user, string $fuelType): void
    {
        $session = $this->sessionManager->getSession($user->id);
        $stateData = $session->getStateData();

        // Get current fuel types
        $fuelTypes = $stateData['data']['fuel_types'] ?? ['regular', 'premium', 'diesel'];

        // Toggle fuel type
        if (in_array($fuelType, $fuelTypes)) {
            // Remove if present
            $fuelTypes = array_diff($fuelTypes, [$fuelType]);
        } else {
            // Add if not present
            $fuelTypes[] = $fuelType;
        }

        // Ensure at least one fuel type is selected
        if (empty($fuelTypes)) {
            $fuelTypes = [$fuelType];
        }

        // Update state data
        $stateData['data']['fuel_types'] = array_values($fuelTypes);
        $session->setStateData($stateData);
        $this->sessionManager->saveSession($session);

        // Refresh step 4 display
        $this->handleStep4($chatId, $user, $stateData['data']['price_change_threshold'] ?? 2);
    }
}
