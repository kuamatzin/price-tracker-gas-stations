<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Webhooks\ScraperController;
use App\Http\Controllers\ScraperTriggerController;

Route::prefix('v1')->group(function () {
    Route::get('/health', [HealthController::class, 'index']);
    
    // Webhook endpoints (no auth required, uses signature verification)
    Route::prefix('webhooks')->group(function () {
        Route::post('/scraper/complete', [ScraperController::class, 'complete'])
            ->middleware('webhook.signature:scraper');
    });

    // Scraper management endpoints (requires authentication)
    Route::prefix('scraper')->middleware('auth:sanctum')->group(function () {
        Route::post('/trigger', [ScraperTriggerController::class, 'trigger']);
        Route::get('/status', [ScraperTriggerController::class, 'status']);
    });
    
    // Future API endpoints will go here
    // Route::prefix('stations')->group(function () {
    //     Route::get('/', [StationController::class, 'index']);
    //     Route::get('/{station}', [StationController::class, 'show']);
    // });
    
    // Route::prefix('prices')->group(function () {
    //     Route::get('/nearby', [PriceController::class, 'nearby']);
    //     Route::get('/history', [PriceController::class, 'history']);
    // });
});