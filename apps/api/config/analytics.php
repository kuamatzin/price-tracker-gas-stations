<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Analytics Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration values for analytics services including cache TTLs,
    | calculation parameters, and business logic thresholds.
    |
    */

    'cache' => [
        // Cache TTL in seconds
        'trends_ttl' => env('ANALYTICS_TRENDS_CACHE_TTL', 3600), // 1 hour
        'ranking_ttl' => env('ANALYTICS_RANKING_CACHE_TTL', 1800), // 30 minutes
        'history_ttl' => env('ANALYTICS_HISTORY_CACHE_TTL', 300), // 5 minutes
        'recommendation_ttl' => env('ANALYTICS_RECOMMENDATION_CACHE_TTL', 1800), // 30 minutes
        'volatility_ttl' => env('ANALYTICS_VOLATILITY_CACHE_TTL', 3600), // 1 hour
    ],

    'radius' => [
        // Default radius values in kilometers
        'default' => env('ANALYTICS_DEFAULT_RADIUS_KM', 5),
        'small' => env('ANALYTICS_SMALL_RADIUS_KM', 3),
        'medium' => env('ANALYTICS_MEDIUM_RADIUS_KM', 5),
        'large' => env('ANALYTICS_LARGE_RADIUS_KM', 10),
    ],

    'time_periods' => [
        // Default time periods in days
        'short' => 7,
        'medium' => 14,
        'long' => 30,
    ],

    'thresholds' => [
        // Trend detection threshold percentage
        'trend_change_percentage' => env('ANALYTICS_TREND_THRESHOLD', 0.5),

        // Ranking recommendation percentiles
        'excellent_percentile' => 75,
        'good_percentile' => 50,
        'weak_percentile' => 25,

        // Market share calculation weight
        'price_weight' => env('ANALYTICS_PRICE_WEIGHT', 0.7),
    ],

    'fuel_types' => [
        'regular',
        'premium',
        'diesel',
    ],

    'queues' => [
        // Queue priorities
        'analytics_queue' => env('ANALYTICS_QUEUE', 'low'),
        'recommendation_queue' => env('RECOMMENDATION_QUEUE', 'medium'),
        'report_queue' => env('REPORT_QUEUE', 'high'),
    ],

    'retry' => [
        // Job retry configuration
        'max_attempts' => env('ANALYTICS_MAX_RETRY', 3),
        'backoff_seconds' => [60, 180, 300], // 1min, 3min, 5min
    ],

    'limits' => [
        // Result set limits
        'most_active_stations' => 10,
        'top_competitors' => 3,
        'max_history_days' => 90,
    ],
];
