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

// Process user alerts every hour
Schedule::command('alerts:process')
    ->hourly()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/alerts.log'))
    ->onSuccess(function () {
        Log::info('Alert processing completed successfully');
    })
    ->onFailure(function () {
        Log::error('Alert processing failed');
    });

// Pre-generate analytics for active stations daily at 4 AM
Schedule::call(function () {
    $activeStations = \App\Models\Station::where('is_active', true)
        ->whereHas('users')
        ->pluck('numero');
    
    foreach ($activeStations as $stationNumero) {
        \App\Jobs\GenerateAnalyticsJob::dispatch($stationNumero, ['trends', 'ranking'])
            ->onQueue('low');
    }
    
    Log::info('Dispatched analytics pre-generation for ' . $activeStations->count() . ' stations');
})->dailyAt('04:00')
    ->name('analytics:pre-generate')
    ->withoutOverlapping();

// Cleanup old analytics data weekly
Schedule::call(function () {
    // Remove analytics cache older than 7 days
    $cutoffDate = now()->subDays(7);
    
    \Illuminate\Support\Facades\DB::table('cache')
        ->where('key', 'like', 'analytics:%')
        ->where('expiration', '<', $cutoffDate->timestamp)
        ->delete();
    
    Log::info('Cleaned up old analytics cache entries');
})->weekly()
    ->sundays()
    ->at('03:00')
    ->name('analytics:cleanup');

// Monitor alert system health every 30 minutes
Schedule::call(function () {
    $stats = [
        'total_alerts' => \App\Models\AlertConfiguration::count(),
        'active_alerts' => \App\Models\AlertConfiguration::where('is_active', true)->count(),
        'triggered_today' => \App\Models\AlertConfiguration::where('last_triggered_at', '>=', now()->startOfDay())->count(),
    ];
    
    Log::info('Alert system health check', $stats);
    
    // Alert if no alerts have been triggered in 24 hours (possible issue)
    if ($stats['active_alerts'] > 10 && $stats['triggered_today'] === 0) {
        Log::warning('No alerts triggered in 24 hours despite active configurations');
    }
})->everyThirtyMinutes()
    ->name('alerts:health-check');

// Send daily summaries based on user preferences
Schedule::command('notifications:send-summaries')
    ->everyMinute() // Check every minute for users due
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/notifications.log'))
    ->onSuccess(function () {
        Log::info('Daily summaries dispatch completed');
    })
    ->onFailure(function () {
        Log::error('Daily summaries dispatch failed');
    });

// Process price alerts
Schedule::command('notifications:process-alerts')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/price-alerts.log'))
    ->onSuccess(function () {
        Log::info('Price alerts processing completed');
    })
    ->onFailure(function () {
        Log::error('Price alerts processing failed');
    });
