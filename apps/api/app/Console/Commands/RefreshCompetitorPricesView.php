<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefreshCompetitorPricesView extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'view:refresh-competitor-prices';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Refresh the competitor_current_prices materialized view';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Refreshing competitor_current_prices materialized view...');

        try {
            DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY competitor_current_prices');
            $this->info('Materialized view refreshed successfully.');

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to refresh materialized view: '.$e->getMessage());

            return Command::FAILURE;
        }
    }
}
