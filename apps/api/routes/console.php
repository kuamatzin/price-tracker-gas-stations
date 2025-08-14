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
