<?php

namespace App\Jobs;

use App\Models\ScraperRun;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ScraperFailureJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public $backoff = [60, 300, 900]; // 1 min, 5 min, 15 min

    /**
     * Create a new job instance.
     */
    public function __construct(
        public ScraperRun $scraperRun
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Log to Sentry
        if (config('sentry.dsn')) {
            \Sentry\captureMessage('Scraper run failed', 'error', [
                'scraper_run_id' => $this->scraperRun->id,
                'errors' => $this->scraperRun->errors,
                'statistics' => $this->scraperRun->statistics,
            ]);
        }

        // Log detailed error information
        Log::error('Scraper failure notification', [
            'scraper_run_id' => $this->scraperRun->id,
            'started_at' => $this->scraperRun->started_at,
            'completed_at' => $this->scraperRun->completed_at,
            'duration' => $this->scraperRun->duration_seconds,
            'errors' => $this->scraperRun->errors,
            'statistics' => $this->scraperRun->statistics,
        ]);

        // Future: Send email notification to admin
        // if (config('mail.mailer') !== 'log') {
        //     Mail::to(config('mail.admin_address'))
        //         ->send(new ScraperFailedMail($this->scraperRun));
        // }

        // Future: Send Telegram notification
        // if (config('telegram.bot_token')) {
        //     $this->sendTelegramNotification();
        // }

        // Check if we should attempt recovery
        $this->attemptRecovery();
    }

    /**
     * Attempt to recover from failure
     */
    protected function attemptRecovery(): void
    {
        // Check how many failures in the last 24 hours
        $recentFailures = ScraperRun::failed()
            ->where('created_at', '>=', now()->subDay())
            ->count();

        if ($recentFailures >= 3) {
            Log::critical('Multiple scraper failures detected', [
                'failures_count' => $recentFailures,
                'action' => 'Manual intervention required',
            ]);

            // Could trigger additional alerts here
            return;
        }

        // If not too many failures, schedule a retry
        $nextRetryTime = now()->addMinutes(30);

        Log::info('Scheduling scraper retry', [
            'next_retry' => $nextRetryTime,
            'previous_run_id' => $this->scraperRun->id,
        ]);

        // Dispatch a new trigger job with delay
        TriggerScraperJob::dispatch(false, \Str::uuid()->toString())
            ->delay($nextRetryTime);
    }

    /**
     * Send Telegram notification (future implementation)
     */
    protected function sendTelegramNotification(): void
    {
        // This would be implemented when Telegram bot is configured
        // Example implementation:
        /*
        $botToken = config('telegram.bot_token');
        $chatId = config('telegram.admin_chat_id');

        $message = "⚠️ *Scraper Failed*\n\n";
        $message .= "Run ID: {$this->scraperRun->id}\n";
        $message .= "Duration: {$this->scraperRun->duration_seconds}s\n";
        $message .= "Errors: " . count($this->scraperRun->errors) . "\n";

        Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $message,
            'parse_mode' => 'Markdown',
        ]);
        */
    }
}
