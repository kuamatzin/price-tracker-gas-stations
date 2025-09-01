<?php

namespace App\Jobs;

use App\Repositories\AlertRepository;
use App\Repositories\AnalyticsRepository;
use App\Services\Telegram\TelegramSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;

class ProcessAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 180, 300]; // Exponential backoff
    
    private int $userId;
    private ?int $alertId;

    /**
     * Create a new job instance.
     */
    public function __construct(int $userId, ?int $alertId = null)
    {
        $this->userId = $userId;
        $this->alertId = $alertId;
        $this->onQueue('high'); // High priority queue
    }

    /**
     * Execute the job.
     */
    public function handle(
        AlertRepository $alertRepository,
        AnalyticsRepository $analyticsRepository
    ): void {
        try {
            // Get user's active alerts
            if ($this->alertId) {
                $alerts = collect([$alertRepository->find($this->alertId)]);
            } else {
                $alerts = $alertRepository->getActiveUserAlerts($this->userId);
            }

            if ($alerts->isEmpty()) {
                return;
            }

            $user = \App\Models\User::find($this->userId);
            if (!$user || !$user->telegram_chat_id) {
                Log::warning('ProcessAlertsJob: User not found or no Telegram ID', [
                    'user_id' => $this->userId
                ]);
                return;
            }

            // Get user's stations
            $userStations = $user->stations()->pluck('station_numero')->toArray();
            
            if (empty($userStations)) {
                return;
            }

            // Get recent price changes
            $priceChanges = $analyticsRepository->getRecentPriceChanges($userStations, 1);
            
            // Get market statistics for trend alerts
            $municipioId = $user->stations()->first()->municipio_id ?? null;
            $marketStats = $municipioId 
                ? $analyticsRepository->getMarketStatistics($municipioId, null, 1)
                : [];

            // Process each alert
            foreach ($alerts as $alert) {
                if ($alert->isInCooldown()) {
                    continue;
                }

                $shouldTrigger = false;
                $notificationData = [];

                switch ($alert->type) {
                    case 'price_change':
                        $relevantChanges = $this->filterPriceChanges($priceChanges, $alert);
                        if (!$relevantChanges->isEmpty() && 
                            $alertRepository->evaluatePriceChangeAlert($alert, $relevantChanges->toArray())) {
                            $shouldTrigger = true;
                            $notificationData = $this->preparePriceChangeNotification($alert, $relevantChanges);
                        }
                        break;

                    case 'competitor_move':
                        // Get competitor changes
                        $competitorStations = $this->getCompetitorStations($user, $alert);
                        if (!empty($competitorStations)) {
                            $competitorChanges = $analyticsRepository->getRecentPriceChanges($competitorStations, 1);
                            
                            if (!$competitorChanges->isEmpty() &&
                                $alertRepository->evaluateCompetitorMoveAlert($alert, $competitorChanges->toArray())) {
                                $shouldTrigger = true;
                                $notificationData = $this->prepareCompetitorNotification($alert, $competitorChanges);
                            }
                        }
                        break;

                    case 'market_trend':
                        if ($alertRepository->evaluateMarketTrendAlert($alert, $marketStats)) {
                            $shouldTrigger = true;
                            $notificationData = $this->prepareMarketTrendNotification($alert, $marketStats);
                        }
                        break;
                }

                if ($shouldTrigger) {
                    $this->sendNotification($user, $alert, $notificationData);
                    $alertRepository->markAsTriggered($alert->id);
                }
            }

        } catch (\Exception $e) {
            Log::error('ProcessAlertsJob failed', [
                'user_id' => $this->userId,
                'alert_id' => $this->alertId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw $e; // Re-throw for retry mechanism
        }
    }

    /**
     * Filter price changes based on alert conditions
     */
    private function filterPriceChanges($priceChanges, $alert)
    {
        $conditions = $alert->conditions;
        $fuelTypes = $conditions['fuel_types'] ?? ['regular', 'premium', 'diesel'];
        $threshold = $conditions['threshold_percentage'] ?? 2.0;

        return $priceChanges->filter(function ($change) use ($fuelTypes, $threshold) {
            return in_array($change->fuel_type, $fuelTypes) 
                   && abs($change->change_percentage) >= $threshold;
        });
    }

    /**
     * Get competitor stations for the user
     */
    private function getCompetitorStations($user, $alert): array
    {
        $conditions = $alert->conditions;
        $radiusKm = $conditions['radius_km'] ?? 5;
        
        $userStation = $user->stations()->first();
        if (!$userStation) {
            return [];
        }

        // Get nearby stations
        $competitors = \App\Models\Station::select('numero')
            ->where('is_active', true)
            ->where('numero', '!=', $userStation->station_numero)
            ->whereRaw("(6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
                       cos(radians(lng) - radians(?)) + sin(radians(?)) * 
                       sin(radians(lat)))) <= ?", 
                       [$userStation->lat, $userStation->lng, $userStation->lat, $radiusKm])
            ->pluck('numero')
            ->toArray();

        return $competitors;
    }

    /**
     * Prepare price change notification data
     */
    private function preparePriceChangeNotification($alert, $changes): array
    {
        $data = [
            'alert_name' => $alert->name,
            'changes' => []
        ];

        foreach ($changes as $change) {
            $data['changes'][] = [
                'fuel_type' => ucfirst($change->fuel_type),
                'old_price' => number_format($change->old_price, 2),
                'new_price' => number_format($change->new_price, 2),
                'change_amount' => number_format($change->change_amount, 2),
                'change_percentage' => number_format($change->change_percentage, 1),
                'direction' => $change->change_amount > 0 ? 'subió' : 'bajó'
            ];
        }

        return $data;
    }

    /**
     * Prepare competitor notification data
     */
    private function prepareCompetitorNotification($alert, $changes): array
    {
        $data = [
            'alert_name' => $alert->name,
            'competitor_changes' => []
        ];

        foreach ($changes->take(5) as $change) { // Limit to 5 competitors
            $station = \App\Models\Station::where('numero', $change->station_numero)->first();
            
            $data['competitor_changes'][] = [
                'station_name' => $station->nombre ?? 'Competidor',
                'brand' => $station->brand ?? 'Desconocido',
                'fuel_type' => ucfirst($change->fuel_type),
                'change_percentage' => number_format($change->change_percentage, 1),
                'new_price' => number_format($change->new_price, 2)
            ];
        }

        return $data;
    }

    /**
     * Prepare market trend notification data
     */
    private function prepareMarketTrendNotification($alert, $marketStats): array
    {
        $data = [
            'alert_name' => $alert->name,
            'trends' => []
        ];

        foreach ($marketStats as $fuelType => $stats) {
            if (isset($stats['volatility']) && $stats['volatility'] > 2) {
                $data['trends'][] = [
                    'fuel_type' => ucfirst($fuelType),
                    'average' => number_format($stats['average'], 2),
                    'volatility' => number_format($stats['volatility'], 1),
                    'min' => number_format($stats['minimum'], 2),
                    'max' => number_format($stats['maximum'], 2)
                ];
            }
        }

        return $data;
    }

    /**
     * Send notification to user via Telegram
     */
    private function sendNotification($user, $alert, array $data): void
    {
        $message = $this->formatNotificationMessage($alert->type, $data);

        try {
            Telegram::sendMessage([
                'chat_id' => $user->telegram_chat_id,
                'text' => $message,
                'parse_mode' => 'Markdown'
            ]);

            Log::info('Alert notification sent', [
                'user_id' => $user->id,
                'alert_id' => $alert->id,
                'alert_type' => $alert->type
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send alert notification', [
                'user_id' => $user->id,
                'alert_id' => $alert->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Format notification message based on alert type
     */
    private function formatNotificationMessage(string $type, array $data): string
    {
        $message = "🔔 *Alerta: {$data['alert_name']}*\n\n";

        switch ($type) {
            case 'price_change':
                $message .= "💰 *Cambios de precio detectados:*\n";
                foreach ($data['changes'] as $change) {
                    $arrow = $change['direction'] === 'subió' ? '↑' : '↓';
                    $message .= "\n{$change['fuel_type']}: {$arrow} {$change['direction']} ";
                    $message .= "{$change['change_percentage']}% ";
                    $message .= "(${$change['old_price']} → ${$change['new_price']})\n";
                }
                break;

            case 'competitor_move':
                $message .= "🏪 *Movimientos de competidores:*\n";
                foreach ($data['competitor_changes'] as $change) {
                    $arrow = $change['change_percentage'] > 0 ? '↑' : '↓';
                    $message .= "\n{$change['brand']} - {$change['fuel_type']}: ";
                    $message .= "{$arrow} {$change['change_percentage']}% ";
                    $message .= "(Nuevo: ${$change['new_price']})\n";
                }
                break;

            case 'market_trend':
                $message .= "📊 *Tendencias del mercado:*\n";
                foreach ($data['trends'] as $trend) {
                    $message .= "\n{$trend['fuel_type']}: ";
                    $message .= "Promedio ${$trend['average']} ";
                    $message .= "(Volatilidad: {$trend['volatility']}%)\n";
                    $message .= "Rango: ${$trend['min']} - ${$trend['max']}\n";
                }
                break;
        }

        $message .= "\n_Usa /ranking para ver tu posición competitiva_";

        return $message;
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessAlertsJob permanently failed', [
            'user_id' => $this->userId,
            'alert_id' => $this->alertId,
            'error' => $exception->getMessage()
        ]);
    }
}