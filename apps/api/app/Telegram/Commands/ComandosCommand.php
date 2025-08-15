<?php

namespace App\Telegram\Commands;

use Telegram\Bot\Keyboard\Keyboard;

class ComandosCommand extends BaseCommand
{
    /**
     * @var string Command Name
     */
    protected $name = 'comandos';

    /**
     * @var string Command Description
     */
    protected $description = 'Menú de comandos por categoría';

    /**
     * Execute the command
     */
    public function handle(): void
    {
        $chatId = $this->getChatId();
        $this->sendTypingAction($chatId);
        
        $this->showMainMenu($chatId);
    }

    /**
     * Show main menu with categories
     */
    protected function showMainMenu($chatId): void
    {
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '💰 Precios',
                    'callback_data' => 'menu:precios'
                ]),
                Keyboard::inlineButton([
                    'text' => '📊 Análisis',
                    'callback_data' => 'menu:analisis'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⚙️ Configuración',
                    'callback_data' => 'menu:configuracion'
                ]),
                Keyboard::inlineButton([
                    'text' => '❓ Ayuda',
                    'callback_data' => 'menu:ayuda'
                ])
            ]);
        
        $text = "*📋 Menú de Comandos*\n\n";
        $text .= "Selecciona una categoría para ver los comandos disponibles:\n\n";
        $text .= "💰 *Precios* - Consulta precios actuales y de competencia\n";
        $text .= "📊 *Análisis* - Tendencias, rankings e historial\n";
        $text .= "⚙️ *Configuración* - Personaliza tu experiencia\n";
        $text .= "❓ *Ayuda* - Información y soporte\n\n";
        $text .= "También puedes escribir comandos directamente o usar lenguaje natural.";
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'Markdown',
            'reply_markup' => $keyboard
        ]);
    }

    /**
     * Show price commands menu
     */
    public static function showPriceMenu($telegram, $chatId, $messageId = null): void
    {
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '💵 Mis precios',
                    'callback_data' => 'cmd:precios'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '🏪 Competencia',
                    'callback_data' => 'cmd:precios_competencia'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '📈 Promedio municipal',
                    'callback_data' => 'cmd:precio_promedio'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⬅️ Volver',
                    'callback_data' => 'menu:main'
                ])
            ]);
        
        $text = "*💰 Comandos de Precios*\n\n";
        $text .= "`/precios` - Ver precios actuales de tu estación\n";
        $text .= "`/precios_competencia` - Precios de competidores cercanos\n";
        $text .= "`/precio_promedio` - Promedio de precios en tu municipio\n\n";
        $text .= "Selecciona una opción:";
        
        if ($messageId) {
            $telegram->editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        } else {
            $telegram->sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        }
    }

    /**
     * Show analysis commands menu
     */
    public static function showAnalysisMenu($telegram, $chatId, $messageId = null): void
    {
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '📈 Tendencia',
                    'callback_data' => 'cmd:tendencia'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '🏆 Mi ranking',
                    'callback_data' => 'cmd:ranking'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '📜 Historial',
                    'callback_data' => 'cmd:historial'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⬅️ Volver',
                    'callback_data' => 'menu:main'
                ])
            ]);
        
        $text = "*📊 Comandos de Análisis*\n\n";
        $text .= "`/tendencia` - Ver tendencia de precios (7 días)\n";
        $text .= "`/ranking` - Tu posición entre competidores\n";
        $text .= "`/historial [días]` - Historial de precios\n\n";
        $text .= "Selecciona una opción:";
        
        if ($messageId) {
            $telegram->editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        } else {
            $telegram->sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        }
    }

    /**
     * Show configuration commands menu
     */
    public static function showConfigMenu($telegram, $chatId, $messageId = null): void
    {
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '⚙️ Preferencias',
                    'callback_data' => 'cmd:configurar'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⛽ Mi estación',
                    'callback_data' => 'cmd:mi_estacion'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '🔔 Notificaciones',
                    'callback_data' => 'cmd:notificaciones'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '🔇 Silenciar',
                    'callback_data' => 'cmd:silencio'
                ]),
                Keyboard::inlineButton([
                    'text' => '🌐 Idioma',
                    'callback_data' => 'cmd:idioma'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⬅️ Volver',
                    'callback_data' => 'menu:main'
                ])
            ]);
        
        $text = "*⚙️ Comandos de Configuración*\n\n";
        $text .= "`/configurar` - Configurar preferencias generales\n";
        $text .= "`/mi_estacion` - Actualizar datos de tu estación\n";
        $text .= "`/notificaciones` - Configurar alertas de precios\n";
        $text .= "`/silencio [horas]` - Pausar notificaciones\n";
        $text .= "`/idioma` - Cambiar idioma del bot\n\n";
        $text .= "Selecciona una opción:";
        
        if ($messageId) {
            $telegram->editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        } else {
            $telegram->sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        }
    }

    /**
     * Show help menu
     */
    public static function showHelpMenu($telegram, $chatId, $messageId = null): void
    {
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '📖 Lista de comandos',
                    'callback_data' => 'cmd:help'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '🚀 Inicio rápido',
                    'callback_data' => 'cmd:start'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '💬 Soporte',
                    'url' => 'https://t.me/fuelintel_support'
                ])
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '⬅️ Volver',
                    'callback_data' => 'menu:main'
                ])
            ]);
        
        $text = "*❓ Ayuda y Soporte*\n\n";
        $text .= "`/help` - Ver todos los comandos disponibles\n";
        $text .= "`/start` - Reiniciar y ver menú principal\n";
        $text .= "`/comandos` - Este menú interactivo\n\n";
        $text .= "Para soporte adicional, contacta a @fuelintel_support\n\n";
        $text .= "Selecciona una opción:";
        
        if ($messageId) {
            $telegram->editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        } else {
            $telegram->sendMessage([
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'Markdown',
                'reply_markup' => $keyboard
            ]);
        }
    }
}