<?php

namespace App\Services;

use App\Jobs\ScraperFailureJob;
use App\Models\ScraperRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ScraperRunService
{
    /**
     * Record a scraper run from webhook data
     */
    public function recordRun(array $data): ScraperRun
    {
        return DB::transaction(function () use ($data) {
            $scraperRun = ScraperRun::create([
                'started_at' => $data['started_at'],
                'completed_at' => $data['completed_at'],
                'status' => $data['status'],
                'statistics' => $data['statistics'],
                'errors' => $data['errors'] ?? [],
                'duration_seconds' => null, // Will be calculated
            ]);

            // Calculate and update duration
            $scraperRun->duration_seconds = $scraperRun->calculateDuration();
            $scraperRun->save();

            // Handle failed runs
            if ($data['status'] === 'failed') {
                $this->handleFailedRun($scraperRun);
            }

            return $scraperRun;
        });
    }

    /**
     * Handle a failed scraper run
     */
    protected function handleFailedRun(ScraperRun $scraperRun): void
    {
        Log::error('Scraper run failed', [
            'scraper_run_id' => $scraperRun->id,
            'errors' => $scraperRun->errors,
        ]);

        // Dispatch job for notifications and recovery
        ScraperFailureJob::dispatch($scraperRun);
    }

    /**
     * Check if data is stale
     */
    public function isDataStale(int $thresholdHours = 25): bool
    {
        $lastRun = ScraperRun::lastSuccessful();

        if (! $lastRun) {
            return true; // No successful runs means data is stale
        }

        $hoursSinceLastRun = now()->diffInHours($lastRun->completed_at);

        return $hoursSinceLastRun > $thresholdHours;
    }

    /**
     * Get data freshness information
     */
    public function getDataFreshness(): array
    {
        $lastRun = ScraperRun::lastSuccessful();

        if (! $lastRun) {
            return [
                'is_stale' => true,
                'last_run' => null,
                'hours_ago' => null,
                'message' => 'No successful scraper runs found',
            ];
        }

        $hoursSinceLastRun = now()->diffInHours($lastRun->completed_at);
        $isStale = $hoursSinceLastRun > 25;

        return [
            'is_stale' => $isStale,
            'last_run' => $lastRun->completed_at->toIso8601String(),
            'hours_ago' => round($hoursSinceLastRun, 1),
            'message' => $isStale
                ? "Data is stale (last update {$hoursSinceLastRun} hours ago)"
                : "Data is fresh (last update {$hoursSinceLastRun} hours ago)",
        ];
    }
}
