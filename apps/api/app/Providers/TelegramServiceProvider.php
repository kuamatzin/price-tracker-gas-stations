<?php

namespace App\Providers;

use App\Exceptions\Telegram\BotExceptionHandler;
use App\Services\Telegram\CallbackHandler;
use App\Services\Telegram\CommandParser;
use App\Services\Telegram\CommandRegistry;
use App\Services\Telegram\MessageRouter;
use App\Services\Telegram\SessionManager;
use App\Services\Telegram\TranslationService;
use Illuminate\Support\ServiceProvider;

class TelegramServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register services as singletons
        $this->app->singleton(SessionManager::class);
        $this->app->singleton(TranslationService::class);
        $this->app->singleton(CommandParser::class);

        // Register command registry and populate it
        $this->app->singleton(CommandRegistry::class, function ($app) {
            $registry = new CommandRegistry;

            // Register all commands
            $registry->registerMany([
                'start' => \App\Telegram\Commands\StartCommand::class,
                'help' => \App\Telegram\Commands\HelpCommand::class,
                'comandos' => \App\Telegram\Commands\ComandosCommand::class,
                // Future commands will be added here
                // 'precios' => \App\Telegram\Commands\PreciosCommand::class,
                // 'precios_competencia' => \App\Telegram\Commands\PreciosCompetenciaCommand::class,
                // 'precio_promedio' => \App\Telegram\Commands\PrecioPromedioCommand::class,
                // 'tendencia' => \App\Telegram\Commands\TendenciaCommand::class,
                // 'ranking' => \App\Telegram\Commands\RankingCommand::class,
                // 'configurar' => \App\Telegram\Commands\ConfigurarCommand::class,
                // 'mi_estacion' => \App\Telegram\Commands\MiEstacionCommand::class,
                // 'notificaciones' => \App\Telegram\Commands\NotificacionesCommand::class,
                // 'silencio' => \App\Telegram\Commands\SilencioCommand::class,
                // 'idioma' => \App\Telegram\Commands\IdiomaCommand::class,
            ]);

            return $registry;
        });

        // Register callback handler
        $this->app->singleton(CallbackHandler::class);

        // Register message router
        $this->app->singleton(MessageRouter::class);

        // Register exception handler
        $this->app->singleton(BotExceptionHandler::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Update Telegram bot config with registered commands
        $this->updateTelegramConfig();
    }

    /**
     * Update Telegram configuration with registered commands
     */
    protected function updateTelegramConfig(): void
    {
        $registry = $this->app->make(CommandRegistry::class);
        $commands = $registry->all()->values()->toArray();

        // Update config
        config([
            'telegram.bots.fuelintel.commands' => $commands,
        ]);
    }
}
