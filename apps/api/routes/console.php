<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule the scraper to run daily at configured time
Schedule::command('scraper:run')
    ->dailyAt(config('scraper.run_time', '05:00'))
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/scraper.log'))
    ->onSuccess(function () {
        Log::info('Scraper schedule completed successfully');
    })
    ->onFailure(function () {
        Log::error('Scraper schedule failed');
        // Future: Send notification
    });

// Prune old Telescope entries daily
if (config('telescope.enabled')) {
    Schedule::command('telescope:prune')
        ->daily()
        ->at('02:00');
    
    // Keep entries for 7 days in local, 30 days in production
    Schedule::command('telescope:prune', [
        '--hours' => config('app.env') === 'production' ? 720 : 168
    ])
        ->daily()
        ->at('02:30');
}

// Refresh competitor prices materialized view every 15 minutes
Schedule::command('view:refresh-competitor-prices')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Competitor prices view refreshed successfully');
    })
    ->onFailure(function () {
        Log::error('Failed to refresh competitor prices view');
    });
