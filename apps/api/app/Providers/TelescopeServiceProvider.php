<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Telescope::night();

        $this->hideSensitiveRequestDetails();

        // Only enable Telescope if TELESCOPE_ENABLED is true
        if (! config('telescope.enabled', false)) {
            Telescope::stopRecording();
        }

        $isLocal = $this->app->environment('local');

        Telescope::filter(function (IncomingEntry $entry) use ($isLocal) {
            return $isLocal ||
                   $entry->isReportableException() ||
                   $entry->isFailedRequest() ||
                   $entry->isFailedJob() ||
                   $entry->isScheduledTask() ||
                   $entry->hasMonitoredTag();
        });

        Telescope::tag(function (IncomingEntry $entry) {
            $tags = [];

            if ($entry->type === 'request') {
                if (str_contains($entry->content['uri'] ?? '', '/webhooks/scraper')) {
                    $tags[] = 'scraper';
                }
                if (str_contains($entry->content['uri'] ?? '', '/api/v1/prices')) {
                    $tags[] = 'prices';
                }
                if (str_contains($entry->content['uri'] ?? '', '/api/v1/stations')) {
                    $tags[] = 'stations';
                }
            }

            if ($entry->type === 'job' && str_contains($entry->content['name'] ?? '', 'Scraper')) {
                $tags[] = 'scraper';
            }

            return $tags;
        });
    }

    /**
     * Prevent sensitive request details from being logged by Telescope.
     */
    protected function hideSensitiveRequestDetails(): void
    {
        if ($this->app->environment('local')) {
            return;
        }

        Telescope::hideRequestParameters(['_token']);

        Telescope::hideRequestHeaders([
            'cookie',
            'x-csrf-token',
            'x-xsrf-token',
        ]);
    }

    /**
     * Register the Telescope gate.
     *
     * This gate determines who can access Telescope in non-local environments.
     */
    protected function gate(): void
    {
        Gate::define('viewTelescope', function ($user) {
            return in_array($user->email, [
                //
            ]);
        });
    }
}
