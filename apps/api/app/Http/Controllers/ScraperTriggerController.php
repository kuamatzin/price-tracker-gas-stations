<?php

namespace App\Http\Controllers;

use App\Jobs\TriggerScraperJob;
use App\Services\ScraperRunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ScraperTriggerController extends Controller
{
    public function __construct(
        private ScraperRunService $scraperRunService
    ) {}

    /**
     * Trigger a manual scraper run
     */
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dry_run' => 'boolean',
            'force' => 'boolean',
        ]);

        $dryRun = $validated['dry_run'] ?? false;
        $force = $validated['force'] ?? false;

        // Check if a scraper is already running (unless forced)
        if (!$force) {
            $recentRun = \App\Models\ScraperRun::where('status', 'running')
                ->where('started_at', '>=', now()->subHours(2))
                ->first();

            if ($recentRun) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Scraper is already running',
                    'current_run_id' => $recentRun->id,
                ], 409);
            }
        }

        // Generate a unique job ID
        $jobId = Str::uuid()->toString();

        // Queue the scraper execution
        TriggerScraperJob::dispatch($dryRun, $jobId);

        Log::info('Scraper manually triggered', [
            'job_id' => $jobId,
            'dry_run' => $dryRun,
            'force' => $force,
            'triggered_by' => $request->user()?->id,
        ]);

        return response()->json([
            'status' => 'queued',
            'job_id' => $jobId,
            'message' => 'Scraper execution queued',
            'dry_run' => $dryRun,
        ]);
    }

    /**
     * Get current scraper status
     */
    public function status(): JsonResponse
    {
        $freshness = $this->scraperRunService->getDataFreshness();
        
        $lastRun = \App\Models\ScraperRun::orderBy('created_at', 'desc')->first();
        $runningRun = \App\Models\ScraperRun::where('status', 'running')->first();

        $status = [
            'is_running' => $runningRun !== null,
            'data_freshness' => $freshness,
            'last_run' => null,
            'current_run' => null,
        ];

        if ($lastRun) {
            $status['last_run'] = [
                'id' => $lastRun->id,
                'started_at' => $lastRun->started_at?->toIso8601String(),
                'completed_at' => $lastRun->completed_at?->toIso8601String(),
                'status' => $lastRun->status,
                'duration_seconds' => $lastRun->duration_seconds,
                'statistics' => $lastRun->statistics,
            ];
        }

        if ($runningRun) {
            $status['current_run'] = [
                'id' => $runningRun->id,
                'started_at' => $runningRun->started_at?->toIso8601String(),
                'elapsed_seconds' => $runningRun->started_at ? 
                    now()->diffInSeconds($runningRun->started_at) : null,
            ];
        }

        return response()->json($status);
    }
}