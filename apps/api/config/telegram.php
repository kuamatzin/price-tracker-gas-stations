<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Bot Name
    |--------------------------------------------------------------------------
    |
    | Here you may specify which of the bots below you wish to use as
    | your default bot for regular use. Of course, you may use many
    | bots at once using the manager class.
    |
    */
    'default' => 'fuelintel',

    /*
    |--------------------------------------------------------------------------
    | Telegram Bots
    |--------------------------------------------------------------------------
    |
    | Here are each of the telegram bots config.
    |
    | Supported Params:
    |
    | - username: Your Telegram Bot's Username.
    |         Example: (string) 'BotFather'.
    |
    | - token:    Your Telegram Bot's Access Token.
    |              Refer for more details: https://core.telegram.org/bots#botfather
    |              Example: (string) '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'.
    |
    | - commands: (Optional) Commands to register for this bot,
    |              Supported Values: "Command Group Name", "Shared Command Name", "Full Path to Class".
    |              Default: Registers Global Commands.
    |              Example: (array) [
    |                  'admin', // Command Group Name.
    |                  'status', // Shared Command Name.
    |                  Acme\Project\Commands\BotFather\HelloCommand::class,
    |                  Acme\Project\Commands\BotFather\ByeCommand::class,
    |              ]
    */
    'bots' => [
        'fuelintel' => [
            'username' => env('TELEGRAM_BOT_USERNAME', 'fuelintel_bot'),
            'token' => env('TELEGRAM_BOT_TOKEN'),
            'certificate_path' => env('TELEGRAM_CERTIFICATE_PATH'),
            'webhook_url' => env('TELEGRAM_WEBHOOK_URL'),
            'commands' => [
                // Price query commands
                \App\Telegram\Commands\PreciosCommand::class,
                \App\Telegram\Commands\PreciosTodasCommand::class,
                \App\Telegram\Commands\PreciosCompetenciaCommand::class,
                \App\Telegram\Commands\PrecioPromedioCommand::class,
                \App\Telegram\Commands\PrecioCommand::class,
                \App\Telegram\Commands\EstacionDefaultCommand::class,
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Asynchronous Requests [Optional]
    |--------------------------------------------------------------------------
    |
    | When set to True, All the requests would be made non-blocking (Async).
    |
    | Default: false
    | Possible Values: (Boolean) "true" OR "false"
    |
    */
    'async_requests' => env('TELEGRAM_ASYNC_REQUESTS', false),

    /*
    |--------------------------------------------------------------------------
    | HTTP Client Handler [Optional]
    |--------------------------------------------------------------------------
    |
    | If you'd like to use a custom HTTP Client Handler.
    | Should be an instance of \Telegram\Bot\HttpClients\HttpClientInterface
    |
    | Default: GuzzlePHP
    |
    */
    'http_client_handler' => null,

    /*
    |--------------------------------------------------------------------------
    | Resolve Injected Dependencies in commands [Optional]
    |--------------------------------------------------------------------------
    |
    | Using Laravel's IoC container, we can easily type hint dependencies in
    | our command's constructor and have them automatically resolved for us.
    |
    | Default: true
    | Possible Values: (Boolean) "true" OR "false"
    |
    */
    'resolve_command_dependencies' => true,

    /*
    |--------------------------------------------------------------------------
    | Register Telegram Global Commands [Optional]
    |--------------------------------------------------------------------------
    |
    | If you'd like to use the SDK's built in command handler system,
    | You can register all the global commands here.
    |
    | Global commands will be applied to all the bots in system and are always active.
    |
    | The command class should extend the \Telegram\Bot\Commands\Command class.
    |
    | Default: The SDK registers, a help command which when a user sends /help
    | will respond with a list of available commands and description.
    |
    */
    'commands' => [
        // Telegram\Bot\Commands\HelpCommand::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Command Groups [Optional]
    |--------------------------------------------------------------------------
    |
    | You can organize a set of commands into groups which can later,
    | be re-used across all your bots.
    |
    | You can create 4 types of groups:
    | 1. Group using full path to command classes.
    | 2. Group using shared commands: Provide the key name of the shared command
    | and the system will automatically resolve to the appropriate command.
    | 3. Group using other groups of commands: You can create a group which uses other
    | groups of commands to bundle them into one group.
    | 4. You can create a group with a combination of 1, 2 and 3 all together in one group.
    |
    | Examples shown below are by the group type for you to understand each of them.
    */
    'command_groups' => [
        /* // Group Type: 1
           'commmon' => [
                Acme\Project\Commands\TodoCommand::class,
                Acme\Project\Commands\TaskCommand::class,
           ],
        */

        /* // Group Type: 2
           'subscription' => [
                'start', // Shared Command Name.
                'stop', // Shared Command Name.
           ],
        */

        /* // Group Type: 3
            'auth' => [
                Acme\Project\Commands\LoginCommand::class,
                Acme\Project\Commands\SomeCommand::class,
            ],

            'stats' => [
                Acme\Project\Commands\UserStatsCommand::class,
                Acme\Project\Commands\SubscriberStatsCommand::class,
                Acme\Project\Commands\ReportsCommand::class,
            ],

            'admin' => [
                'auth', // Command Group Name.
                'stats' // Command Group Name.
            ],
        */

        /* // Group Type: 4
           'myBot' => [
                'admin', // Command Group Name.
                'subscription', // Command Group Name.
                'status', // Shared Command Name.
                'Acme\Project\Commands\BotCommand' // Full Path to Command Class.
           ],
        */
    ],

    /*
    |--------------------------------------------------------------------------
    | Shared Commands [Optional]
    |--------------------------------------------------------------------------
    |
    | Shared commands let you register commands that can be shared between,
    | one or more bots across the project.
    |
    | This will help you prevent from having to register same set of commands,
    | for each bot over and over again and make it easier to maintain them.
    |
    | Shared commands are not active by default, You need to use the key name to register them,
    | individually in a group of commands or in bot commands.
    | Think of this as a central storage, to register, reuse and maintain them across all bots.
    |
    */
    'shared_commands' => [
        // 'start' => Acme\Project\Commands\StartCommand::class,
        // 'stop' => Acme\Project\Commands\StopCommand::class,
        // 'status' => Acme\Project\Commands\StatusCommand::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Performance & Error Handling Configuration
    |--------------------------------------------------------------------------
    */
    'max_concurrent_conversations' => env('TELEGRAM_MAX_CONCURRENT_CONVERSATIONS', 100),
    'rate_limit_per_user' => env('TELEGRAM_RATE_LIMIT_PER_USER', 30),
    'rate_limit_global' => env('TELEGRAM_RATE_LIMIT_GLOBAL', 1000),
    'session_compression' => env('TELEGRAM_SESSION_COMPRESSION', true),
    'admin_chat_ids' => array_filter(explode(',', env('TELEGRAM_ADMIN_CHAT_IDS', ''))),
    'health_check_interval' => env('TELEGRAM_HEALTH_CHECK_INTERVAL', 60),
    'metrics_enabled' => env('TELEGRAM_METRICS_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Circuit Breaker Configuration
    |--------------------------------------------------------------------------
    */
    'circuit_breaker' => [
        'deepseek' => [
            'failure_threshold' => env('CIRCUIT_BREAKER_DEEPSEEK_FAILURE_THRESHOLD', 5),
            'cooldown_ms' => env('CIRCUIT_BREAKER_DEEPSEEK_COOLDOWN_MS', 60000),
            'success_threshold' => env('CIRCUIT_BREAKER_DEEPSEEK_SUCCESS_THRESHOLD', 3),
        ],
        'laravel_api' => [
            'failure_threshold' => env('CIRCUIT_BREAKER_LARAVEL_API_FAILURE_THRESHOLD', 3),
            'cooldown_ms' => env('CIRCUIT_BREAKER_LARAVEL_API_COOLDOWN_MS', 30000),
            'success_threshold' => env('CIRCUIT_BREAKER_LARAVEL_API_SUCCESS_THRESHOLD', 2),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Timeout Configuration (milliseconds)
    |--------------------------------------------------------------------------
    */
    'timeouts' => [
        'deepseek_api' => env('TIMEOUT_DEEPSEEK_API', 2000),
        'price_query' => env('TIMEOUT_PRICE_QUERY', 3000),
        'analytics' => env('TIMEOUT_ANALYTICS', 5000),
        'webhook' => env('TIMEOUT_WEBHOOK', 30000),
        'default' => env('TIMEOUT_DEFAULT', 10000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Error Messages in Spanish
    |--------------------------------------------------------------------------
    */
    'error_messages' => [
        'timeout' => '⏱️ La operación tardó demasiado. Por favor, intenta de nuevo en unos momentos.',
        'rate_limit' => '🚦 Has alcanzado el límite de solicitudes. Intenta de nuevo en {minutes} minutos.',
        'service_unavailable' => '🔧 El servicio está temporalmente no disponible. Estamos trabajando para solucionarlo.',
        'invalid_input' => '❓ No entendí tu solicitud. Usa /help para ver los comandos disponibles.',
        'circuit_open' => '⚡ Servicio en mantenimiento. Por favor, intenta más tarde.',
        'session_expired' => '⏰ Tu sesión ha expirado. Por favor, inicia de nuevo con /start.',
        'unauthorized' => '❌ No autorizado',
        'general_error' => '❌ Ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a soporte con /help.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Degradation Configuration
    |--------------------------------------------------------------------------
    */
    'degradation_levels' => [
        'healthy' => [
            'all_features' => true,
        ],
        'degraded' => [
            'disable_nlp' => true,
            'disable_analytics' => true,
            'slow_mode' => true,
        ],
        'unhealthy' => [
            'read_only' => true,
            'emergency_responses' => true,
        ],
    ],
];
