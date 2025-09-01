<?php

namespace App\Console\Commands;

use App\Jobs\ProcessAlertsJob;
use App\Repositories\AlertRepository;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ProcessUserAlertsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'alerts:process 
                            {--user= : Process alerts for specific user ID}
                            {--dry-run : Run without actually sending notifications}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process user alerts and send notifications for triggered conditions';

    private AlertRepository $alertRepository;

    /**
     * Create a new command instance.
     */
    public function __construct(AlertRepository $alertRepository)
    {
        parent::__construct();
        $this->alertRepository = $alertRepository;
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $startTime = microtime(true);
        $this->info('Starting alert processing...');

        try {
            $userId = $this->option('user');
            $dryRun = $this->option('dry-run');

            if ($userId) {
                $this->processUserAlerts($userId, $dryRun);
            } else {
                $this->processAllAlerts($dryRun);
            }

            $executionTime = round(microtime(true) - $startTime, 2);
            $this->info("Alert processing completed in {$executionTime} seconds.");

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error('Alert processing failed: '.$e->getMessage());

            Log::error('ProcessUserAlertsCommand failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return Command::FAILURE;
        }
    }

    /**
     * Process alerts for a specific user
     */
    private function processUserAlerts(int $userId, bool $dryRun): void
    {
        $this->info("Processing alerts for user ID: {$userId}");

        $alerts = $this->alertRepository->getActiveUserAlerts($userId);

        if ($alerts->isEmpty()) {
            $this->warn("No active alerts found for user {$userId}");

            return;
        }

        $this->info("Found {$alerts->count()} active alerts for user {$userId}");

        if ($dryRun) {
            $this->info("DRY RUN: Would process {$alerts->count()} alerts");
            foreach ($alerts as $alert) {
                $this->line("  - {$alert->name} (Type: {$alert->type})");
            }
        } else {
            ProcessAlertsJob::dispatch($userId);
            $this->info("Dispatched alert processing job for user {$userId}");
        }
    }

    /**
     * Process alerts for all users
     */
    private function processAllAlerts(bool $dryRun): void
    {
        $this->info('Processing alerts for all users...');

        // Get alerts ready to be processed (respecting cooldown)
        $alerts = $this->alertRepository->getAlertsToProcess(60); // 60 minutes cooldown

        if ($alerts->isEmpty()) {
            $this->info('No alerts ready for processing');

            return;
        }

        // Group alerts by user
        $alertsByUser = $alerts->groupBy('user_id');
        $this->info("Found alerts for {$alertsByUser->count()} users");

        $jobCount = 0;
        foreach ($alertsByUser as $userId => $userAlerts) {
            $this->line("User {$userId}: {$userAlerts->count()} alerts");

            if (! $dryRun) {
                ProcessAlertsJob::dispatch($userId);
                $jobCount++;
            }
        }

        if ($dryRun) {
            $this->info("DRY RUN: Would dispatch {$alertsByUser->count()} jobs");
        } else {
            $this->info("Dispatched {$jobCount} alert processing jobs");
        }

        // Log statistics
        $this->logStatistics($alerts);
    }

    /**
     * Log alert processing statistics
     */
    private function logStatistics($alerts): void
    {
        $stats = [
            'total' => $alerts->count(),
            'by_type' => $alerts->groupBy('type')->map->count(),
            'users' => $alerts->pluck('user_id')->unique()->count(),
        ];

        $this->info('Alert Statistics:');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Total Alerts', $stats['total']],
                ['Unique Users', $stats['users']],
                ['Price Change Alerts', $stats['by_type']['price_change'] ?? 0],
                ['Competitor Move Alerts', $stats['by_type']['competitor_move'] ?? 0],
                ['Market Trend Alerts', $stats['by_type']['market_trend'] ?? 0],
            ]
        );

        Log::info('Alert processing statistics', $stats);
    }
}
