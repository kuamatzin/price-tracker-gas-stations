<?php

namespace App\Services\Telegram;

use Illuminate\Support\Collection;
use Telegram\Bot\Keyboard\Keyboard;

class InlineKeyboardBuilder
{
    /**
     * Build station selection keyboard
     */
    public function buildStationSelection(Collection $stations, string $commandPrefix = ''): string
    {
        $buttons = [];
        
        foreach ($stations as $station) {
            $buttons[] = [
                [
                    'text' => $station->alias,
                    'callback_data' => "station:{$commandPrefix}:{$station->id}"
                ]
            ];
        }
        
        // Add "Ver todas" button if multiple stations
        if ($stations->count() > 1) {
            $buttons[] = [
                [
                    'text' => 'Ver todas',
                    'callback_data' => "station:{$commandPrefix}:all"
                ]
            ];
        }
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Build fuel type selection keyboard
     */
    public function buildFuelTypeSelection(string $commandPrefix = ''): string
    {
        $buttons = [
            [
                ['text' => '⛽ Regular', 'callback_data' => "fuel:{$commandPrefix}:regular"],
                ['text' => '⭐ Premium', 'callback_data' => "fuel:{$commandPrefix}:premium"]
            ],
            [
                ['text' => '🚚 Diesel', 'callback_data' => "fuel:{$commandPrefix}:diesel"],
                ['text' => '📊 Todos', 'callback_data' => "fuel:{$commandPrefix}:all"]
            ]
        ];
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Build confirmation keyboard
     */
    public function buildConfirmation(string $actionId): string
    {
        $buttons = [
            [
                ['text' => '✅ Sí', 'callback_data' => "confirm:{$actionId}:yes"],
                ['text' => '❌ No', 'callback_data' => "confirm:{$actionId}:no"]
            ]
        ];
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Build paginated list keyboard
     */
    public function buildPaginatedList(
        Collection $items,
        int $page = 1,
        int $perPage = 5,
        string $commandPrefix = ''
    ): array {
        $total = $items->count();
        $totalPages = ceil($total / $perPage);
        $offset = ($page - 1) * $perPage;
        
        $pageItems = $items->slice($offset, $perPage);
        
        $buttons = [];
        
        // Add item buttons
        foreach ($pageItems as $index => $item) {
            $globalIndex = $offset + $index;
            $buttons[] = [
                [
                    'text' => $item->display_name ?? $item->nombre ?? "Item " . ($globalIndex + 1),
                    'callback_data' => "{$commandPrefix}:select:{$globalIndex}"
                ]
            ];
        }
        
        // Add navigation buttons
        $navButtons = [];
        
        if ($page > 1) {
            $navButtons[] = [
                'text' => '⬅️ Anterior',
                'callback_data' => "{$commandPrefix}:page:" . ($page - 1)
            ];
        }
        
        if ($totalPages > 1) {
            $navButtons[] = [
                'text' => "{$page}/{$totalPages}",
                'callback_data' => "{$commandPrefix}:page:current"
            ];
        }
        
        if ($page < $totalPages) {
            $navButtons[] = [
                'text' => 'Siguiente ➡️',
                'callback_data' => "{$commandPrefix}:page:" . ($page + 1)
            ];
        }
        
        if (!empty($navButtons)) {
            $buttons[] = $navButtons;
        }
        
        return [
            'keyboard' => json_encode(['inline_keyboard' => $buttons]),
            'current_page' => $page,
            'total_pages' => $totalPages,
            'items' => $pageItems
        ];
    }

    /**
     * Build action menu keyboard
     */
    public function buildActionMenu(array $actions, string $stationId = null): string
    {
        $buttons = [];
        
        foreach ($actions as $action) {
            $callbackData = $stationId 
                ? "action:{$action['id']}:{$stationId}"
                : "action:{$action['id']}";
                
            $buttons[] = [
                [
                    'text' => $action['text'],
                    'callback_data' => $callbackData
                ]
            ];
        }
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Build radius selection keyboard
     */
    public function buildRadiusSelection(string $commandPrefix = ''): string
    {
        $buttons = [
            [
                ['text' => '1 km', 'callback_data' => "radius:{$commandPrefix}:1"],
                ['text' => '3 km', 'callback_data' => "radius:{$commandPrefix}:3"],
                ['text' => '5 km', 'callback_data' => "radius:{$commandPrefix}:5"]
            ],
            [
                ['text' => '10 km', 'callback_data' => "radius:{$commandPrefix}:10"],
                ['text' => '15 km', 'callback_data' => "radius:{$commandPrefix}:15"],
                ['text' => '20 km', 'callback_data' => "radius:{$commandPrefix}:20"]
            ]
        ];
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Build quick actions keyboard for main menu
     */
    public function buildQuickActions(): string
    {
        $buttons = [
            [
                ['text' => '💰 Precios', 'callback_data' => 'quick:precios'],
                ['text' => '📊 Todas', 'callback_data' => 'quick:precios_todas']
            ],
            [
                ['text' => '🏪 Competencia', 'callback_data' => 'quick:precios_competencia'],
                ['text' => '📈 Promedio', 'callback_data' => 'quick:precio_promedio']
            ],
            [
                ['text' => '➕ Registrar', 'callback_data' => 'quick:registrar'],
                ['text' => '⚙️ Configuración', 'callback_data' => 'quick:config']
            ]
        ];
        
        return json_encode([
            'inline_keyboard' => $buttons
        ]);
    }

    /**
     * Remove inline keyboard
     */
    public function removeKeyboard(): string
    {
        return json_encode([
            'remove_keyboard' => true
        ]);
    }
}