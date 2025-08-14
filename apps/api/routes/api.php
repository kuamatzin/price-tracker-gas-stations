<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\DocumentationController;

Route::get('/health', [HealthController::class, 'index']);
Route::get('/documentation', [DocumentationController::class, 'index']);

// Include versioned API routes
require __DIR__ . '/api/v1.php';

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');