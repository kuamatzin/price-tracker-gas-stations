<?php

return [
    'default' => 'default',
    'documentations' => [
        'default' => [
            'api' => [
                'title' => 'FuelIntel API Documentation',
                'version' => '1.0.0',
                'description' => 'REST API for Mexican fuel price intelligence',
                'contact' => [
                    'name' => 'FuelIntel Support',
                    'email' => 'api@fuelintel.mx',
                ],
                'license' => [
                    'name' => 'Proprietary',
                    'url' => 'https://fuelintel.mx/terms',
                ],
            ],
            'routes' => [
                'api' => 'api/documentation',
                'docs' => 'api/documentation.json',
                'oauth2_callback' => 'api/oauth2-callback',
            ],
            'paths' => [
                'docs' => storage_path('api-docs'),
                'docs_json' => 'api-docs.json',
                'docs_yaml' => 'api-docs.yaml',
                'annotations' => [
                    base_path('app/Http/Controllers'),
                    base_path('app/Http/Controllers/Api'),
                ],
                'schemas' => [
                    base_path('app/Models'),
                ],
            ],
            'security' => [
                [
                    'sanctum' => [],
                ],
            ],
            'securityDefinitions' => [
                'sanctum' => [
                    'type' => 'http',
                    'description' => 'Laravel Sanctum token authentication',
                    'scheme' => 'bearer',
                    'bearerFormat' => 'token',
                ],
            ],
            'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
            'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),
            'proxy' => false,
            'additional_config_url' => null,
            'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),
            'validator_url' => null,
            'ui' => [
                'display' => [
                    'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),
                    'filter' => env('L5_SWAGGER_UI_FILTERS', true),
                ],
                'authorization' => [
                    'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),
                ],
            ],
            'constants' => [
                'L5_SWAGGER_CONST_HOST' => env('L5_SWAGGER_CONST_HOST', 'https://api.fuelintel.mx'),
            ],
        ],
    ],
    'defaults' => [
        'routes' => [
            'docs' => 'docs',
            'api_docs' => 'api-docs',
            'api_oauth2_callback' => 'api-oauth2-callback',
            'middleware' => [
                'api_docs' => [],
                'api_oauth2_callback' => [],
                'docs' => [],
                'asset' => [],
                'oauth2_callback' => [],
            ],
        ],
        'paths' => [
            'docs' => storage_path('api-docs'),
            'views' => base_path('resources/views/vendor/l5-swagger'),
            'base' => env('L5_SWAGGER_BASE_PATH', null),
            'swagger_ui_assets_path' => env('L5_SWAGGER_UI_ASSETS_PATH', 'vendor/swagger-api/swagger-ui/dist/'),
            'excludes' => [],
        ],
        'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
        'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),
        'swagger_version' => env('SWAGGER_VERSION', '3.0'),
        'proxy' => false,
        'additional_config_url' => null,
        'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),
        'validator_url' => null,
        'ui' => [
            'display' => [
                'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),
                'filter' => env('L5_SWAGGER_UI_FILTERS', true),
            ],
            'authorization' => [
                'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),
            ],
        ],
    ],
];
