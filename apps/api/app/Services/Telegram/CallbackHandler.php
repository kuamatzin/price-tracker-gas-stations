<?php

namespace App\Services\Telegram;

use App\Telegram\Commands\ComandosCommand;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;
use Telegram\Bot\Objects\Update;

class CallbackHandler
{
    protected CommandRegistry $registry;

    protected CommandParser $parser;

    protected PricingService $pricingService;

    protected TableFormatter $formatter;

    public function __construct(
        CommandRegistry $registry,
        CommandParser $parser,
        PricingService $pricingService,
        TableFormatter $formatter
    ) {
        $this->registry = $registry;
        $this->parser = $parser;
        $this->pricingService = $pricingService;
        $this->formatter = $formatter;
    }

    /**
     * Handle callback query from inline keyboard
     */
    public function handle(Update $update, TelegramSession $session): void
    {
        $callbackQuery = $update->getCallbackQuery();

        if (! $callbackQuery) {
            return;
        }

        $data = $callbackQuery->getData();
        $chatId = $callbackQuery->getMessage()->getChat()->getId();
        $messageId = $callbackQuery->getMessage()->getMessageId();

        // Answer callback query to remove loading state
        try {
            Telegram::answerCallbackQuery([
                'callback_query_id' => $callbackQuery->getId(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to answer callback query: '.$e->getMessage());
        }

        // Parse callback data
        $parsed = $this->parser->parseCallback($data);
        $action = $parsed['action'];
        $params = $parsed['params'];

        // Route based on action
        switch ($action) {
            case 'menu':
                $this->handleMenuCallback($params[0] ?? 'main', $chatId, $messageId);
                break;

            case 'cmd':
                $this->handleCommandCallback($params[0] ?? '', $chatId, $messageId, $update);
                break;

            case 'register':
                $this->handleRegistrationCallback($params[0] ?? '', $chatId, $messageId, $session);
                break;

            case 'config':
                $this->handleConfigCallback($params, $chatId, $messageId, $session);
                break;

            case 'station':
                $this->handleStationSelection($params, $chatId, $messageId, $session);
                break;

            case 'select_station':
                $this->handleSearchStationSelection($params, $chatId, $messageId);
                break;

            case 'fuel':
                $this->handleFuelSelection($params, $chatId, $messageId, $session);
                break;

            default:
                Log::warning("Unknown callback action: {$action}");
        }
    }

    /**
     * Handle menu navigation callbacks
     */
    protected function handleMenuCallback(string $menu, $chatId, $messageId): void
    {
        switch ($menu) {
            case 'main':
                $this->showMainMenu($chatId, $messageId);
                break;

            case 'precios':
                ComandosCommand::showPriceMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;

            case 'analisis':
                ComandosCommand::showAnalysisMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;

            case 'configuracion':
                ComandosCommand::showConfigMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;

            case 'ayuda':
                ComandosCommand::showHelpMenu(Telegram::getFacadeRoot(), $chatId, $messageId);
                break;

            default:
                Log::warning("Unknown menu: {$menu}");
        }
    }

    /**
     * Handle command execution callbacks
     */
    protected function handleCommandCallback(string $command, $chatId, $messageId, Update $update): void
    {
        // Delete the menu message
        try {
            Telegram::deleteMessage([
                'chat_id' => $chatId,
                'message_id' => $messageId,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to delete message: '.$e->getMessage());
        }

        // Execute the command
        if ($this->registry->has($command)) {
            $commandClass = $this->registry->get($command);

            try {
                $commandInstance = new $commandClass;

                if (method_exists($commandInstance, 'setUpdate')) {
                    $commandInstance->setUpdate($update);
                }

                $commandInstance->handle();
            } catch (\Exception $e) {
                Log::error("Command execution error for /{$command}: ".$e->getMessage());

                Telegram::sendMessage([
                    'chat_id' => $chatId,
                    'text' => '❌ Error al ejecutar el comando. Por favor, intenta de nuevo.',
                ]);
            }
        } else {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => "❌ Comando no disponible: /{$command}",
            ]);
        }
    }

    /**
     * Handle registration callbacks
     */
    protected function handleRegistrationCallback(string $type, $chatId, $messageId, TelegramSession $session): void
    {
        switch ($type) {
            case 'existing':
                // Start registration flow for existing account
                $session->setState('registration:email');
                $session->setStateData(['type' => 'existing']);

                Telegram::editMessageText([
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => "📧 *Conectar cuenta existente*\n\n".
                             'Por favor, ingresa el correo electrónico asociado a tu cuenta de FuelIntel:',
                    'parse_mode' => 'Markdown',
                ]);
                break;

            case 'new':
                // Start registration flow for new account
                $session->setState('registration:email');
                $session->setStateData(['type' => 'new']);

                Telegram::editMessageText([
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'text' => "📝 *Crear cuenta nueva*\n\n".
                             'Por favor, ingresa tu correo electrónico para crear una nueva cuenta:',
                    'parse_mode' => 'Markdown',
                ]);
                break;

            default:
                Log::warning("Unknown registration type: {$type}");
        }
    }

    /**
     * Handle configuration callbacks
     */
    protected function handleConfigCallback(array $params, $chatId, $messageId, TelegramSession $session): void
    {
        $setting = $params[0] ?? '';
        $value = $params[1] ?? '';

        switch ($setting) {
            case 'language':
                $session->setLanguage($value);

                $langName = $value === 'es' ? 'Español' : 'English';

                Telegram::answerCallbackQuery([
                    'callback_query_id' => $messageId,
                    'text' => "✅ Idioma cambiado a {$langName}",
                ]);
                break;

            case 'notifications':
                $enabled = $value === 'on';
                $session->put('notifications_enabled', $enabled);

                $status = $enabled ? 'activadas' : 'desactivadas';

                Telegram::answerCallbackQuery([
                    'callback_query_id' => $messageId,
                    'text' => "✅ Notificaciones {$status}",
                ]);
                break;

            default:
                Log::warning("Unknown config setting: {$setting}");
        }
    }

    /**
     * Show main menu
     */
    protected function showMainMenu($chatId, $messageId): void
    {
        $keyboard = \Telegram\Bot\Keyboard\Keyboard::make()
            ->inline()
            ->row([
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '💰 Precios',
                    'callback_data' => 'menu:precios',
                ]),
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '📊 Análisis',
                    'callback_data' => 'menu:analisis',
                ]),
            ])
            ->row([
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '⚙️ Configuración',
                    'callback_data' => 'menu:configuracion',
                ]),
                \Telegram\Bot\Keyboard\Keyboard::inlineButton([
                    'text' => '❓ Ayuda',
                    'callback_data' => 'menu:ayuda',
                ]),
            ]);

        $text = "*📋 Menú Principal*\n\n";
        $text .= 'Selecciona una categoría:';

        Telegram::editMessageText([
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $text,
            'parse_mode' => 'Markdown',
            'reply_markup' => $keyboard,
        ]);
    }

    /**
     * Handle station selection from inline keyboard
     */
    protected function handleStationSelection(array $params, $chatId, $messageId, TelegramSession $session): void
    {
        $command = $params[0] ?? '';
        $stationId = $params[1] ?? '';

        // Validate station ID
        if (empty($stationId) || (! is_numeric($stationId) && $stationId !== 'all')) {
            Telegram::editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => '❌ Parámetro de estación inválido',
            ]);

            return;
        }

        // Get user ID from session or chat
        $user = \App\Models\User::where('telegram_chat_id', $chatId)->first();
        if (! $user) {
            Telegram::sendMessage([
                'chat_id' => $chatId,
                'text' => '❌ Usuario no registrado',
            ]);

            return;
        }

        if ($stationId === 'all') {
            // Show all stations prices
            $allPrices = $this->pricingService->getAllUserStationPrices($user->id);
            $response = $this->formatAllStationsPrices($allPrices);
        } else {
            // Get selected station
            $userStations = $this->pricingService->getUserStations($user->id);
            $station = $userStations->firstWhere('id', $stationId);

            if (! $station) {
                Telegram::sendMessage([
                    'chat_id' => $chatId,
                    'text' => '❌ Estación no encontrada',
                ]);

                return;
            }

            // Execute command with selected station
            $response = $this->executeCommandWithStation($command, $station, $user->id);
        }

        // Update message with response
        Telegram::editMessageText([
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $response,
            'parse_mode' => 'Markdown',
        ]);
    }

    /**
     * Handle station selection from search results
     */
    protected function handleSearchStationSelection(array $params, $chatId, $messageId): void
    {
        $index = intval($params[0] ?? 0);

        // Validate index
        if ($index < 0 || $index > 100) {
            Telegram::editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => '❌ Índice de estación inválido',
            ]);

            return;
        }

        // Get cached search results
        $cacheKey = "telegram:search:{$chatId}";
        $stations = cache()->get($cacheKey);

        if (! $stations || ! isset($stations[$index])) {
            Telegram::editMessageText([
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => '❌ Sesión expirada. Por favor busca de nuevo.',
            ]);

            return;
        }

        $station = $stations[$index];

        // Show station prices
        $prices = $this->pricingService->getCurrentStationPrices($station->numero);
        $priceHistory = $this->pricingService->getPriceHistory($station->numero, 1);

        $response = $this->formatter->formatStationPrices($station, $prices, $priceHistory);

        // Update message with prices
        Telegram::editMessageText([
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $response,
            'parse_mode' => 'Markdown',
        ]);

        // Clear cache
        cache()->forget($cacheKey);
    }

    /**
     * Handle fuel type selection
     */
    protected function handleFuelSelection(array $params, $chatId, $messageId, TelegramSession $session): void
    {
        $command = $params[0] ?? '';
        $fuelType = $params[1] ?? 'all';

        // Store fuel type in session
        cache()->put("telegram:session:{$chatId}:fuel_type", $fuelType, 300);

        Telegram::editMessageText([
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => 'Filtro aplicado: '.ucfirst($fuelType),
        ]);
    }

    /**
     * Execute command with selected station
     */
    private function executeCommandWithStation(string $command, $station, int $userId): string
    {
        switch ($command) {
            case 'precios':
                $prices = $this->pricingService->getCurrentStationPrices($station->station_numero);
                $priceHistory = $this->pricingService->getPriceHistory($station->station_numero, 1);

                return $this->formatter->formatStationPrices($station, $prices, $priceHistory);

            case 'precios_competencia':
                $nearbyStations = $this->pricingService->getNearbyCompetitorPrices(
                    $station->lat,
                    $station->lng,
                    5,
                    $station->station_numero
                );

                return $this->formatCompetitorPrices($station, $nearbyStations);

            case 'precio_promedio':
                $averages = $this->pricingService->getMunicipioPriceAverages($station->municipio_id);
                $stationPrices = $this->pricingService->getCurrentStationPrices($station->station_numero);

                return $this->formatMunicipalityAverages($station, $averages, $stationPrices);

            default:
                return 'Comando no reconocido';
        }
    }

    /**
     * Format all stations prices
     */
    private function formatAllStationsPrices($allPrices): string
    {
        $response = "💰 **Precios de Todas tus Estaciones**\n\n";

        foreach ($allPrices as $stationData) {
            $station = $stationData['station'];
            $prices = $stationData['prices'];
            $priceHistory = $stationData['history'] ?? collect();

            $response .= $this->formatter->formatCompactStationPrices(
                $station,
                $prices,
                $priceHistory
            );
            $response .= "\n";
        }

        return $response;
    }

    /**
     * Format competitor prices
     */
    private function formatCompetitorPrices($station, $nearbyStations): string
    {
        $response = "🏪 **Precios de Competidores**\n";
        $response .= "📍 Alrededor de: _{$station->alias}_\n\n";

        $response .= "```\n";
        $response .= "Estación         Dist  Regular Premium Diesel\n";
        $response .= "---------------- ---- -------- ------- -------\n";

        foreach ($nearbyStations->take(10) as $competitor) {
            $name = substr($competitor->nombre, 0, 16);
            $name = str_pad($name, 16);
            $dist = sprintf('%3.1f', $competitor->distance);

            $regular = $competitor->regular_price ? sprintf('$%.2f', $competitor->regular_price) : '---';
            $premium = $competitor->premium_price ? sprintf('$%.2f', $competitor->premium_price) : '---';
            $diesel = $competitor->diesel_price ? sprintf('$%.2f', $competitor->diesel_price) : '---';

            $response .= sprintf(
                "%s %skm %8s %7s %7s\n",
                $name,
                $dist,
                $regular,
                $premium,
                $diesel
            );
        }
        $response .= "```\n";

        return $response;
    }

    /**
     * Format municipality averages
     */
    private function formatMunicipalityAverages($station, array $averages, $stationPrices): string
    {
        $response = "📊 **Precios Promedio del Municipio**\n";
        $response .= "📍 Municipio: _{$station->municipio_nombre}_\n";
        $response .= "🏪 Tu estación: _{$station->alias}_\n\n";

        $response .= "```\n";
        $response .= "Tipo     Promedio  Tu Precio  Diferencia\n";
        $response .= "-------- --------- ---------- ----------\n";

        $fuelTypes = ['regular', 'premium', 'diesel'];

        foreach ($fuelTypes as $fuelType) {
            if (isset($averages[$fuelType])) {
                $avgPrice = $averages[$fuelType]['average'];
                $stationPrice = $stationPrices->where('fuel_type', $fuelType)->first();

                if ($stationPrice) {
                    $diff = $stationPrice->price - $avgPrice;
                    $diffPercent = ($diff / $avgPrice) * 100;
                    $indicator = $diff > 0 ? '📈' : ($diff < 0 ? '📉' : '➡️');

                    $response .= sprintf(
                        "%-8s $%7.2f  $%8.2f  %+6.2f%% %s\n",
                        ucfirst($fuelType),
                        $avgPrice,
                        $stationPrice->price,
                        $diffPercent,
                        $indicator
                    );
                }
            }
        }

        $response .= "```\n";

        return $response;
    }
}
