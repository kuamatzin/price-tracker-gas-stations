<?php

namespace App\Console\Commands;

use App\Models\Station;
use App\Services\MarketAggregationService;
use App\Services\TrendAnalysisService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class WarmTrendsCache extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cache:warm-trends 
                            {--popular : Warm cache for popular stations only}
                            {--period=7days : Period to analyze (7days, 30days, etc)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Warm the trend analysis cache for faster API responses';

    public function __construct(
        private TrendAnalysisService $trendService,
        private MarketAggregationService $marketService
    ) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting trend cache warming...');

        $period = $this->option('period');
        $popularOnly = $this->option('popular');

        $days = match ($period) {
            '7days' => 7,
            '30days' => 30,
            '90days' => 90,
            default => 7
        };

        $startDate = now()->subDays($days)->format('Y-m-d');
        $endDate = now()->format('Y-m-d');

        // Warm station trends cache
        $this->warmStationTrends($startDate, $endDate, $popularOnly);

        // Warm market trends cache
        $this->warmMarketTrends($startDate, $endDate);

        $this->info('Cache warming completed successfully!');
    }

    private function warmStationTrends(string $startDate, string $endDate, bool $popularOnly): void
    {
        $query = Station::query();

        if ($popularOnly) {
            // Get stations with most recent price changes
            $query->whereHas('priceChanges', function ($q) {
                $q->where('changed_at', '>=', now()->subDays(7));
            })
                ->withCount('priceChanges')
                ->orderByDesc('price_changes_count')
                ->limit(100);
        }

        $stations = $query->get();
        $bar = $this->output->createProgressBar(count($stations));

        $this->info("Warming cache for {$stations->count()} stations...");

        foreach ($stations as $station) {
            $cacheKey = "trends:station:{$station->numero}:".md5(json_encode([
                'start_date' => $startDate,
                'end_date' => $endDate,
                'period' => 7,
            ]));

            Cache::remember($cacheKey, 3600, function () use ($station, $startDate, $endDate) {
                return $this->trendService->calculateStationTrends(
                    $station->numero,
                    $startDate,
                    $endDate,
                    7
                );
            });

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
    }

    private function warmMarketTrends(string $startDate, string $endDate): void
    {
        $this->info('Warming market trends cache...');

        // National trends
        $nationalKey = 'trends:market:'.md5(json_encode([
            'entidad_id' => null,
            'municipio_id' => null,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'grouping' => 'daily',
        ]));

        Cache::remember($nationalKey, 3600, function () use ($startDate, $endDate) {
            return $this->marketService->getMarketTrends(
                null,
                null,
                $startDate,
                $endDate,
                'daily'
            );
        });

        // Major cities trends
        $majorCities = [
            ['entidad_id' => 9, 'name' => 'CDMX'],  // Ciudad de México
            ['entidad_id' => 14, 'name' => 'Jalisco'],
            ['entidad_id' => 19, 'name' => 'Nuevo León'],
        ];

        foreach ($majorCities as $city) {
            $cityKey = 'trends:market:'.md5(json_encode([
                'entidad_id' => $city['entidad_id'],
                'municipio_id' => null,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'grouping' => 'daily',
            ]));

            Cache::remember($cityKey, 3600, function () use ($city, $startDate, $endDate) {
                return $this->marketService->getMarketTrends(
                    $city['entidad_id'],
                    null,
                    $startDate,
                    $endDate,
                    'daily'
                );
            });

            $this->info("Cached trends for {$city['name']}");
        }
    }
}
