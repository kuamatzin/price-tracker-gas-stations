<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Events\QueryExecuted;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if ($this->app->environment('local')) {
            $this->app->register(\Laravel\Telescope\TelescopeServiceProvider::class);
            $this->app->register(TelescopeServiceProvider::class);
        }
        
        $this->app->singleton('request.id', function () {
            return uniqid('req_');
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (config('app.debug')) {
            DB::listen(function (QueryExecuted $query) {
                Log::channel('daily')->debug('Query executed', [
                    'sql' => $query->sql,
                    'bindings' => $query->bindings,
                    'time' => $query->time . 'ms',
                ]);
            });
        }
        
        config([
            'app.version' => '1.0.0',
        ]);
    }
}
