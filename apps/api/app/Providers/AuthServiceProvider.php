<?php

namespace App\Providers;

use App\Models\AlertConfiguration;
use App\Models\PriceChange;
use App\Models\Station;
use App\Policies\AlertConfigurationPolicy;
use App\Policies\PriceChangePolicy;
use App\Policies\StationPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Station::class => StationPolicy::class,
        AlertConfiguration::class => AlertConfigurationPolicy::class,
        PriceChange::class => PriceChangePolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();

        // Define additional gates for role checking
        Gate::define('station-owner', function ($user, $stationNumero) {
            return $user->stations()
                ->where('station_numero', $stationNumero)
                ->wherePivot('role', 'owner')
                ->exists();
        });

        Gate::define('station-manager', function ($user, $stationNumero) {
            return $user->stations()
                ->where('station_numero', $stationNumero)
                ->wherePivotIn('role', ['owner', 'manager'])
                ->exists();
        });

        Gate::define('station-viewer', function ($user, $stationNumero) {
            return $user->stations()
                ->where('station_numero', $stationNumero)
                ->exists();
        });
    }
}