<?php

use App\Http\Controllers\DocumentationController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Telegram\HealthController as TelegramHealthController;
use App\Http\Controllers\TestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'index']);
Route::get('/documentation', [DocumentationController::class, 'index']);

// Telegram health endpoints
Route::prefix('telegram')->group(function () {
    Route::get('/health', [TelegramHealthController::class, 'health']);
    Route::get('/status', [TelegramHealthController::class, 'status']);
    Route::get('/circuits', [TelegramHealthController::class, 'circuits']);
    Route::get('/metrics', [TelegramHealthController::class, 'metrics']);
});

// Test endpoint for Sentry (local only)
if (config('app.env') === 'local') {
    Route::get('/test/sentry', [TestController::class, 'testSentry']);
}

// Include versioned API routes
require __DIR__.'/api/v1.php';

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
