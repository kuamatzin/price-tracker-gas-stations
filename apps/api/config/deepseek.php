<?php

return [
    'api_key' => env('DEEPSEEK_API_KEY'),
    'api_url' => env('DEEPSEEK_API_URL', 'https://api.deepseek.com/v1'),
    'model' => env('DEEPSEEK_MODEL', 'deepseek-chat'),
    'max_tokens' => env('DEEPSEEK_MAX_TOKENS', 500),
    'temperature' => env('DEEPSEEK_TEMPERATURE', 0.7),
    'timeout_seconds' => env('DEEPSEEK_TIMEOUT_SECONDS', 2),
];