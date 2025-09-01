<?php

namespace App\Jobs;

use App\Models\Station;
use App\Models\User;
use App\Services\Telegram\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPriceAlertJob implements ShouldQueue
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
     * The user ID to send the alert to
     */
    protected int $userId;

    /**
     * The station ID for the price change
     */
    protected int $stationId;

    /**
     * The price changes data
     */
    protected array $priceChanges;

    /**
     * Create a new job instance.
     */
    public function __construct(int $userId, int $stationId, array $priceChanges)
    {
        $this->userId = $userId;
        $this->stationId = $stationId;
        $this->priceChanges = $priceChanges;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $user = User::find($this->userId);

            if (! $user) {
                Log::warning('User not found for price alert', ['user_id' => $this->userId]);

                return;
            }

            $station = Station::find($this->stationId);

            if (! $station) {
                Log::warning('Station not found for price alert', ['station_id' => $this->stationId]);

                return;
            }

            $notificationService = app(NotificationService::class);
            $sent = $notificationService->sendPriceAlert($user, $station, $this->priceChanges);

            if (! $sent) {
                Log::warning('Price alert not sent', [
                    'user_id' => $this->userId,
                    'station_id' => $this->stationId,
                    'reason' => 'Service returned false',
                ]);
            }

        } catch (\Exception $e) {
            Log::error('Price alert job failed', [
                'user_id' => $this->userId,
                'station_id' => $this->stationId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
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
        Log::error('Price alert job permanently failed', [
            'user_id' => $this->userId,
            'station_id' => $this->stationId,
            'price_changes' => $this->priceChanges,
            'error' => $exception->getMessage(),
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
