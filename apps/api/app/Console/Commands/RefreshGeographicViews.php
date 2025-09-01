<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefreshGeographicViews extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'geo:refresh-views';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Refresh geographic materialized views for better performance';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        if (config('database.default') !== 'pgsql') {
            $this->info('Materialized views are only available for PostgreSQL');

            return Command::SUCCESS;
        }

        $this->info('Refreshing geographic materialized views...');

        try {
            // Refresh estado aggregates view
            $this->info('Refreshing estado_price_aggregates...');
            DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY estado_price_aggregates');

            // Refresh municipio aggregates view
            $this->info('Refreshing municipio_price_aggregates...');
            DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY municipio_price_aggregates');

            $this->info('✓ Materialized views refreshed successfully');

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to refresh views: '.$e->getMessage());

            return Command::FAILURE;
        }
    }
}
