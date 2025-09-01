<?php

namespace App\Telegram\Commands;

use Telegram\Bot\Keyboard\Keyboard;

class HelpCommand extends BaseCommand
{
    /**
     * @var string Command Name
     */
    protected $name = 'help';

    /**
     * @var string Command Description
     */
    protected $description = 'Ver lista de comandos disponibles';

    /**
     * Execute the command
     */
    public function handle(): void
    {
        $chatId = $this->getChatId();
        $this->sendTypingAction($chatId);

        $helpText = "*🤖 Comandos Disponibles de FuelIntel*\n\n";

        $helpText .= "*💰 Comandos de Precios:*\n";
        $helpText .= "`/precios` - Precios actuales de tu estación\n";
        $helpText .= "`/precios_competencia` - Precios de competidores cercanos\n";
        $helpText .= "`/precio_promedio` - Promedio de precios en tu municipio\n";
        $helpText .= "`/precio Pemex Centro` - Buscar precio de estación específica\n\n";

        $helpText .= "*📊 Comandos de Análisis:*\n";
        $helpText .= "`/tendencia` - Tendencia de precios (últimos 7 días)\n";
        $helpText .= "`/ranking` - Tu posición entre competidores\n";
        $helpText .= "`/historial 30` - Historial de precios de X días\n\n";

        $helpText .= "*⚙️ Comandos de Configuración:*\n";
        $helpText .= "`/configurar` - Configurar preferencias del bot\n";
        $helpText .= "`/mi_estacion` - Actualizar datos de tu estación\n";
        $helpText .= "`/notificaciones` - Configurar alertas de precios\n";
        $helpText .= "`/silencio 2h` - Pausar notificaciones temporalmente\n";
        $helpText .= "`/idioma` - Cambiar idioma (es/en)\n\n";

        $helpText .= "*🔧 Comandos del Sistema:*\n";
        $helpText .= "`/start` - Iniciar el bot y ver menú principal\n";
        $helpText .= "`/comandos` - Ver menú interactivo de comandos\n";
        $helpText .= "`/help` - Ver esta lista de comandos\n\n";

        $helpText .= "*💡 Ejemplos de uso:*\n";
        $helpText .= "• `/precios premium` - Solo precios de gasolina premium\n";
        $helpText .= "• `/precios diesel` - Solo precios de diesel\n";
        $helpText .= "• `/historial 15` - Historial de últimos 15 días\n";
        $helpText .= "• `/silencio 4h` - Pausar notificaciones por 4 horas\n\n";

        $helpText .= "*🗣 Lenguaje Natural:*\n";
        $helpText .= "También puedes escribir naturalmente:\n";
        $helpText .= "• _\"¿Cuánto está la gasolina?\"_\n";
        $helpText .= "• _\"Precio de diesel en mi zona\"_\n";
        $helpText .= "• _\"Mostrar competencia cercana\"_\n";
        $helpText .= "• _\"¿Cuál es mi ranking?\"_\n\n";

        $helpText .= '💡 *Tip:* Usa /comandos para un menú interactivo con botones.';

        // Add quick action buttons
        $keyboard = Keyboard::make()
            ->inline()
            ->row([
                Keyboard::inlineButton([
                    'text' => '📋 Ver menú de comandos',
                    'callback_data' => 'cmd:comandos',
                ]),
            ])
            ->row([
                Keyboard::inlineButton([
                    'text' => '💰 Ver precios',
                    'callback_data' => 'cmd:precios',
                ]),
                Keyboard::inlineButton([
                    'text' => '⚙️ Configurar',
                    'callback_data' => 'cmd:configurar',
                ]),
            ]);

        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => $helpText,
            'parse_mode' => 'Markdown',
            'reply_markup' => $keyboard,
        ]);
    }
}
