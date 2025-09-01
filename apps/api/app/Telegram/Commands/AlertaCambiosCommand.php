<?php

namespace App\Telegram\Commands;

use App\Repositories\AlertRepository;
use App\Services\Telegram\PricingService;
use Telegram\Bot\Commands\Command;
use Telegram\Bot\Keyboard\Keyboard;

class AlertaCambiosCommand extends Command
{
    protected string $name = 'alerta_cambios';
    protected string $description = 'Configurar alertas de cambios de precio';
    
    private AlertRepository $alertRepository;
    private PricingService $pricingService;

    public function __construct(
        AlertRepository $alertRepository,
        PricingService $pricingService
    ) {
        $this->alertRepository = $alertRepository;
        $this->pricingService = $pricingService;
    }

    public function handle(): void
    {
        $chatId = $this->getUpdate()->getMessage()->getChat()->getId();
        
        try {
            $userId = $this->getUserId($chatId);
        } catch (\Exception $e) {
            $this->replyWithMessage([
                'text' => "❌ Usuario no registrado. Usa /start para registrarte."
            ]);
            return;
        }
        
        $arguments = $this->getArguments();
        $action = $arguments[0] ?? 'list';

        try {
            switch (strtolower($action)) {
                case 'nueva':
                case 'new':
                    $this->handleNewAlert($userId, $chatId, array_slice($arguments, 1));
                    break;
                    
                case 'lista':
                case 'list':
                    $this->handleListAlerts($userId, $chatId);
                    break;
                    
                case 'activar':
                case 'enable':
                    $this->handleToggleAlert($userId, $chatId, $arguments[1] ?? null, true);
                    break;
                    
                case 'desactivar':
                case 'disable':
                    $this->handleToggleAlert($userId, $chatId, $arguments[1] ?? null, false);
                    break;
                    
                case 'eliminar':
                case 'delete':
                    $this->handleDeleteAlert($userId, $chatId, $arguments[1] ?? null);
                    break;
                    
                default:
                    $this->showHelp($chatId);
                    break;
            }
        } catch (\Exception $e) {
            \Log::error('AlertaCambiosCommand error', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            $this->replyWithMessage([
                'text' => "❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde."
            ]);
        }
    }

    private function handleNewAlert(int $userId, int $chatId, array $params): void
    {
        // Parse parameters for alert configuration
        $type = 'price_change'; // Default
        $threshold = 2.0; // Default 2% change
        $fuelTypes = ['regular', 'premium', 'diesel']; // Default all
        $radiusKm = 5; // Default 5km
        
        foreach ($params as $param) {
            if (is_numeric($param)) {
                if ($param <= 10) {
                    $threshold = (float) $param;
                } else {
                    $radiusKm = (float) $param;
                }
            } elseif (in_array(strtolower($param), ['regular', 'premium', 'diesel'])) {
                if ($params === $param) {
                    $fuelTypes = [strtolower($param)];
                }
            } elseif (in_array(strtolower($param), ['price_change', 'competitor_move', 'market_trend'])) {
                $type = strtolower($param);
            }
        }

        // Check user's alert limit
        $currentAlerts = $this->alertRepository->getUserAlerts($userId);
        if ($currentAlerts->count() >= 10) {
            $this->replyWithMessage([
                'text' => "❌ Has alcanzado el límite máximo de 10 alertas.\nElimina alguna alerta existente para crear una nueva."
            ]);
            return;
        }

        // Create the alert
        $alertName = $this->generateAlertName($type, $threshold);
        
        $conditions = [
            'fuel_types' => $fuelTypes,
            'threshold_percentage' => $threshold,
            'radius_km' => $radiusKm,
            'comparison_type' => 'any'
        ];

        $alert = $this->alertRepository->create([
            'user_id' => $userId,
            'name' => $alertName,
            'type' => $type,
            'conditions' => $conditions,
            'is_active' => true
        ]);

        $response = "✅ *Alerta creada exitosamente*\n\n";
        $response .= "📋 Nombre: {$alertName}\n";
        $response .= "🔔 Tipo: " . $this->getTypeLabel($type) . "\n";
        $response .= "⚡ Umbral: {$threshold}%\n";
        $response .= "⛽ Combustibles: " . implode(', ', array_map('ucfirst', $fuelTypes)) . "\n";
        $response .= "📏 Radio: {$radiusKm}km\n\n";
        $response .= "Recibirás notificaciones cuando se cumplan las condiciones.";

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    private function handleListAlerts(int $userId, int $chatId): void
    {
        $alerts = $this->alertRepository->getUserAlerts($userId);

        if ($alerts->isEmpty()) {
            $this->replyWithMessage([
                'text' => "📭 No tienes alertas configuradas.\n\nUsa `/alerta_cambios nueva` para crear tu primera alerta.",
                'parse_mode' => 'Markdown'
            ]);
            return;
        }

        $response = "🔔 *Tus Alertas Configuradas*\n\n";

        foreach ($alerts as $index => $alert) {
            $number = $index + 1;
            $status = $alert->is_active ? '✅' : '🔴';
            $conditions = $alert->conditions;
            
            $response .= "{$number}. {$status} *{$alert->name}*\n";
            $response .= "   Tipo: " . $this->getTypeLabel($alert->type) . "\n";
            
            if (isset($conditions['threshold_percentage'])) {
                $response .= "   Umbral: {$conditions['threshold_percentage']}%\n";
            }
            
            if (isset($conditions['fuel_types'])) {
                $fuels = implode(', ', array_map('ucfirst', $conditions['fuel_types']));
                $response .= "   Combustibles: {$fuels}\n";
            }
            
            if ($alert->last_triggered_at) {
                $lastTriggered = \Carbon\Carbon::parse($alert->last_triggered_at)->diffForHumans();
                $response .= "   Última vez: {$lastTriggered}\n";
            }
            
            $response .= "\n";
        }

        $response .= "💡 Comandos:\n";
        $response .= "`/alerta_cambios activar [#]` - Activar alerta\n";
        $response .= "`/alerta_cambios desactivar [#]` - Desactivar alerta\n";
        $response .= "`/alerta_cambios eliminar [#]` - Eliminar alerta";

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    private function handleToggleAlert(int $userId, int $chatId, ?string $alertNumber, bool $activate): void
    {
        if (!$alertNumber || !is_numeric($alertNumber)) {
            $this->replyWithMessage([
                'text' => "❌ Por favor especifica el número de la alerta.\nEjemplo: `/alerta_cambios " . ($activate ? 'activar' : 'desactivar') . " 1`",
                'parse_mode' => 'Markdown'
            ]);
            return;
        }

        $alerts = $this->alertRepository->getUserAlerts($userId);
        $index = (int) $alertNumber - 1;

        if (!isset($alerts[$index])) {
            $this->replyWithMessage([
                'text' => "❌ No se encontró la alerta #{$alertNumber}.\nUsa `/alerta_cambios lista` para ver tus alertas.",
                'parse_mode' => 'Markdown'
            ]);
            return;
        }

        $alert = $alerts[$index];
        $this->alertRepository->update($alert->id, ['is_active' => $activate]);

        $action = $activate ? 'activada' : 'desactivada';
        $emoji = $activate ? '✅' : '🔴';

        $this->replyWithMessage([
            'text' => "{$emoji} Alerta *{$alert->name}* {$action} exitosamente.",
            'parse_mode' => 'Markdown'
        ]);
    }

    private function handleDeleteAlert(int $userId, int $chatId, ?string $alertNumber): void
    {
        if (!$alertNumber || !is_numeric($alertNumber)) {
            $this->replyWithMessage([
                'text' => "❌ Por favor especifica el número de la alerta.\nEjemplo: `/alerta_cambios eliminar 1`",
                'parse_mode' => 'Markdown'
            ]);
            return;
        }

        $alerts = $this->alertRepository->getUserAlerts($userId);
        $index = (int) $alertNumber - 1;

        if (!isset($alerts[$index])) {
            $this->replyWithMessage([
                'text' => "❌ No se encontró la alerta #{$alertNumber}.\nUsa `/alerta_cambios lista` para ver tus alertas.",
                'parse_mode' => 'Markdown'
            ]);
            return;
        }

        $alert = $alerts[$index];
        $this->alertRepository->delete($alert->id);

        $this->replyWithMessage([
            'text' => "🗑️ Alerta *{$alert->name}* eliminada exitosamente.",
            'parse_mode' => 'Markdown'
        ]);
    }

    private function showHelp(int $chatId): void
    {
        $response = "🔔 *Configuración de Alertas*\n\n";
        $response .= "*Comandos disponibles:*\n\n";
        $response .= "`/alerta_cambios nueva [tipo] [umbral%] [combustible]`\n";
        $response .= "Crear nueva alerta\n\n";
        $response .= "`/alerta_cambios lista`\n";
        $response .= "Ver todas tus alertas\n\n";
        $response .= "`/alerta_cambios activar [#]`\n";
        $response .= "Activar una alerta\n\n";
        $response .= "`/alerta_cambios desactivar [#]`\n";
        $response .= "Desactivar una alerta\n\n";
        $response .= "`/alerta_cambios eliminar [#]`\n";
        $response .= "Eliminar una alerta\n\n";
        
        $response .= "*Tipos de alerta:*\n";
        $response .= "• `price_change` - Cambios de precio\n";
        $response .= "• `competitor_move` - Movimientos de competidores\n";
        $response .= "• `market_trend` - Tendencias del mercado\n\n";
        
        $response .= "*Ejemplos:*\n";
        $response .= "`/alerta_cambios nueva price_change 3 regular`\n";
        $response .= "Alerta cuando regular cambie más de 3%\n\n";
        $response .= "`/alerta_cambios nueva competitor_move 2`\n";
        $response .= "Alerta cuando competidores cambien más de 2%";

        $this->replyWithMessage([
            'text' => $response,
            'parse_mode' => 'Markdown'
        ]);
    }

    private function getUserId(int $chatId): int
    {
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();
        
        if (!$user) {
            throw new \Exception('Usuario no registrado');
        }
        
        return $user->id;
    }

    private function generateAlertName(string $type, float $threshold): string
    {
        switch ($type) {
            case 'price_change':
                return "Cambio de precio >{$threshold}%";
            case 'competitor_move':
                return "Movimiento competidor >{$threshold}%";
            case 'market_trend':
                return "Tendencia mercado >{$threshold}%";
            default:
                return "Alerta personalizada";
        }
    }

    private function getTypeLabel(string $type): string
    {
        switch ($type) {
            case 'price_change':
                return 'Cambio de precio';
            case 'competitor_move':
                return 'Movimiento de competidor';
            case 'market_trend':
                return 'Tendencia del mercado';
            default:
                return ucfirst(str_replace('_', ' ', $type));
        }
    }
}