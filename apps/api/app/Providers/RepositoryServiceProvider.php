<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Future repository bindings will go here
        // Example:
        // $this->app->bind(
        //     \App\Repositories\Contracts\StationRepositoryInterface::class,
        //     \App\Repositories\StationRepository::class
        // );
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}