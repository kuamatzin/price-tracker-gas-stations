<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Telegram\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendDailySummaryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     */
    public $timeout = 60;

    /**
     * The user ID to send the summary to
     */
    protected int $userId;

    /**
     * Create a new job instance.
     */
    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $user = User::find($this->userId);
            
            if (!$user) {
                Log::warning('User not found for daily summary', ['user_id' => $this->userId]);
                return;
            }
            
            $notificationService = app(NotificationService::class);
            $sent = $notificationService->sendDailySummary($user);
            
            if (!$sent) {
                Log::warning('Daily summary not sent', [
                    'user_id' => $this->userId,
                    'reason' => 'Service returned false'
                ]);
            }
            
        } catch (\Exception $e) {
            Log::error('Daily summary job failed', [
                'user_id' => $this->userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Re-throw to trigger retry
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Daily summary job permanently failed', [
            'user_id' => $this->userId,
            'error' => $exception->getMessage()
        ]);
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        return [60, 120, 300]; // 1 minute, 2 minutes, 5 minutes
    }
}