<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\DocumentationController;
use App\Http\Controllers\TestController;

Route::get('/health', [HealthController::class, 'index']);
Route::get('/documentation', [DocumentationController::class, 'index']);

// Test endpoint for Sentry (local only)
if (config('app.env') === 'local') {
    Route::get('/test/sentry', [TestController::class, 'testSentry']);
}

// Include versioned API routes
require __DIR__ . '/api/v1.php';

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');