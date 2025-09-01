<?php

namespace App\Jobs;

use App\Models\ScraperRun;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class TriggerScraperJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 1;

    /**
     * The number of seconds the job can run before timing out.
     */
    public $timeout = 3600; // 1 hour

    /**
     * Create a new job instance.
     */
    public function __construct(
        public bool $dryRun,
        public string $jobId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('Starting scraper execution', [
            'job_id' => $this->jobId,
            'dry_run' => $this->dryRun,
        ]);

        // Record the start of the run
        $scraperRun = ScraperRun::create([
            'started_at' => now(),
            'status' => 'running',
            'statistics' => [
                'job_id' => $this->jobId,
                'dry_run' => $this->dryRun,
            ],
        ]);

        try {
            $command = config('scraper.command');

            if ($this->dryRun) {
                $command .= ' --dry-run';
            }

            // Execute the scraper command
            $result = Process::path(base_path())
                ->timeout(config('scraper.timeout'))
                ->run($command);

            if ($result->successful()) {
                Log::info('Scraper execution completed successfully', [
                    'job_id' => $this->jobId,
                    'output' => $result->output(),
                ]);

                // The webhook will update the scraper run with final status
            } else {
                Log::error('Scraper execution failed', [
                    'job_id' => $this->jobId,
                    'exit_code' => $result->exitCode(),
                    'error' => $result->errorOutput(),
                ]);

                // Update the run as failed if webhook doesn't fire
                $scraperRun->update([
                    'completed_at' => now(),
                    'status' => 'failed',
                    'duration_seconds' => now()->diffInSeconds($scraperRun->started_at),
                    'errors' => [
                        [
                            'type' => 'EXECUTION_ERROR',
                            'message' => $result->errorOutput(),
                            'exit_code' => $result->exitCode(),
                        ],
                    ],
                ]);

                throw new \Exception('Scraper execution failed with exit code: '.$result->exitCode());
            }
        } catch (\Exception $e) {
            Log::error('Exception during scraper execution', [
                'job_id' => $this->jobId,
                'error' => $e->getMessage(),
            ]);

            // Update the run as failed
            if ($scraperRun->status === 'running') {
                $scraperRun->update([
                    'completed_at' => now(),
                    'status' => 'failed',
                    'duration_seconds' => now()->diffInSeconds($scraperRun->started_at),
                    'errors' => [
                        [
                            'type' => 'EXCEPTION',
                            'message' => $e->getMessage(),
                        ],
                    ],
                ]);
            }

            throw $e;
        }
    }
}
