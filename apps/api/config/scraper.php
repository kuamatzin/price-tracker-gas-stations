<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Scraper Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the Node.js scraper integration including webhook
    | authentication, execution settings, and monitoring thresholds.
    |
    */

    'run_time' => env('SCRAPER_RUN_TIME', '05:00'),
    
    'webhook_secret' => env('SCRAPER_WEBHOOK_SECRET'),

    'command' => env('SCRAPER_COMMAND', 'cd ../scraper && npm run scrape'),

    'timeout' => env('SCRAPER_TIMEOUT', 3600), // 1 hour default
    
    'max_retries' => env('SCRAPER_MAX_RETRIES', 3),

    'data_stale_hours' => env('DATA_STALE_HOURS', 25),

    'api_token' => env('SCRAPER_API_TOKEN'),

    'metrics_url' => env('SCRAPER_METRICS_URL', 'http://localhost:9090/metrics'),

    'health_url' => env('SCRAPER_HEALTH_URL', 'http://localhost:9090/health'),
];