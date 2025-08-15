<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Webhooks\ScraperController;
use App\Http\Controllers\ScraperTriggerController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RefreshController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Api\PriceController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\TrendController;
use App\Http\Controllers\Api\CompetitorController;
use App\Http\Controllers\Api\AnalysisController;
use App\Http\Controllers\Api\GeoController;
use App\Http\Controllers\Api\StatusController;
use App\Http\Controllers\TelegramController;

Route::prefix('v1')->middleware('api.version:v1')->group(function () {
    Route::get('/health', [HealthController::class, 'index']);
    
    // Public authentication routes
    Route::post('/auth/register', [RegisterController::class, 'register']);
    Route::post('/auth/login', [LoginController::class, 'login'])
        ->middleware('account.lockout')
        ->name('auth.login');
    Route::post('/auth/forgot-password', [PasswordResetController::class, 'sendReset']);
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset']);
    
    // Webhook endpoints (no auth required, uses signature verification)
    Route::prefix('webhooks')->group(function () {
        Route::post('/scraper/complete', [ScraperController::class, 'complete'])
            ->middleware('webhook.signature:scraper');
    });
    
    // Telegram webhook endpoint (no auth required, Telegram verifies via token)
    Route::post('/telegram/webhook', [TelegramController::class, 'webhook']);
    Route::get('/telegram/set-webhook', [TelegramController::class, 'setWebhook']);
    Route::get('/telegram/remove-webhook', [TelegramController::class, 'removeWebhook']);
    Route::get('/telegram/webhook-info', [TelegramController::class, 'getWebhookInfo']);

    // Protected authentication routes
    Route::middleware(['auth:sanctum', 'throttle:tier'])->group(function () {
        // Authentication
        Route::post('/auth/logout', [LogoutController::class, 'logout']);
        Route::post('/auth/refresh', [RefreshController::class, 'refresh']);
        
        // Profile
        Route::get('/profile', [ProfileController::class, 'show']);
        Route::put('/profile', [ProfileController::class, 'update']);
    });

    // Scraper management endpoints (requires authentication)
    Route::prefix('scraper')->middleware('auth:sanctum')->group(function () {
        Route::post('/trigger', [ScraperTriggerController::class, 'trigger']);
        Route::get('/status', [ScraperTriggerController::class, 'status']);
    });
    
    // Price endpoints (requires authentication)
    Route::prefix('prices')->middleware(['auth:sanctum', 'performance.monitor'])->group(function () {
        Route::get('/current', [PriceController::class, 'current']);
        Route::get('/station/{numero}', [PriceController::class, 'station']);
        Route::get('/nearby', [PriceController::class, 'nearby']);
        Route::get('/history/{station_id}', [HistoryController::class, 'getStationHistory']);
    });
    
    // Trend endpoints (requires authentication)
    Route::prefix('trends')->middleware(['auth:sanctum', 'performance.monitor'])->group(function () {
        Route::get('/station/{id}', [TrendController::class, 'getStationTrends']);
        Route::get('/market', [TrendController::class, 'getMarketTrends']);
    });
    
    // Competitor endpoints (requires authentication)
    Route::prefix('competitors')->middleware(['auth:sanctum', 'performance.monitor'])->group(function () {
        Route::get('/', [CompetitorController::class, 'index']);
    });
    
    // Analysis endpoints (requires authentication)
    Route::prefix('analysis')->middleware(['auth:sanctum', 'performance.monitor'])->group(function () {
        Route::get('/ranking', [AnalysisController::class, 'ranking']);
        Route::get('/spread', [AnalysisController::class, 'spread']);
        Route::get('/insights', [AnalysisController::class, 'insights']);
    });
    
    // Geographic aggregation endpoints (requires authentication)
    Route::prefix('geo')->middleware(['auth:sanctum', 'performance.monitor'])->group(function () {
        Route::get('/estados', [GeoController::class, 'estados']);
        Route::get('/municipios/{estado}', [GeoController::class, 'municipiosByEstado']);
        Route::get('/stats/{municipio}', [GeoController::class, 'municipioStats']);
        Route::post('/compare', [GeoController::class, 'compare']);
        Route::get('/heatmap', [GeoController::class, 'heatmap']);
    });
    
    // Status and monitoring endpoints
    Route::prefix('status')->group(function () {
        Route::get('/health', [StatusController::class, 'health']); // Public health check
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/dashboard', [StatusController::class, 'dashboard']);
            Route::get('/metrics', [StatusController::class, 'metrics']);
        });
    });
});