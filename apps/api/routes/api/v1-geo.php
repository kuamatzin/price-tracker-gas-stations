<?php

use App\Http\Controllers\Api\GeoController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    // Geographic aggregation endpoints
    Route::prefix('geo')->group(function () {
        Route::get('/estados', [GeoController::class, 'estados']);
        Route::get('/municipios/{estado}', [GeoController::class, 'municipiosByEstado']);
        Route::get('/stats/{municipio}', [GeoController::class, 'municipioStats']);
        Route::post('/compare', [GeoController::class, 'compare']);
        Route::get('/heatmap', [GeoController::class, 'heatmap']);
    });
});
