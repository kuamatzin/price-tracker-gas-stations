<?php

return [
    'tiers' => [
        'free' => 100,      // 100 requests per hour
        'basic' => 500,     // 500 requests per hour
        'premium' => 1000,  // 1000 requests per hour
        'enterprise' => 10000, // 10000 requests per hour
    ],

    'burst_limits' => [
        'free' => 10,       // 10 requests burst
        'basic' => 50,      // 50 requests burst
        'premium' => 100,   // 100 requests burst
        'enterprise' => 500, // 500 requests burst
    ],

    'endpoints' => [
        // Specific rate limits for expensive endpoints
        'analysis/*' => [
            'free' => 10,
            'basic' => 50,
            'premium' => 100,
            'enterprise' => 500,
        ],
        'geo/heatmap' => [
            'free' => 20,
            'basic' => 100,
            'premium' => 200,
            'enterprise' => 1000,
        ],
    ],
];
