<?php

namespace App\Services\Telegram;

use App\Models\PriceChange;
use App\Models\Station;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;
use Telegram\Bot\Laravel\Facades\Telegram;

class NotificationService
{
    private AnalyticsService $analyticsService;

    private SparklineGenerator $sparklineGenerator;

    public function __construct(
        AnalyticsService $analyticsService,
        SparklineGenerator $sparklineGenerator
    ) {
        $this->analyticsService = $analyticsService;
        $this->sparklineGenerator = $sparklineGenerator;
    }

    /**
     * Send daily summary to a user
     */
    public function sendDailySummary(User $user): bool
    {
        try {
            // Check if user has telegram chat ID
            if (! $user->telegram_chat_id) {
                Log::warning('User has no telegram chat ID', ['user_id' => $user->id]);

                return false;
            }

            // Check if daily summary is enabled
            $preferences = $user->notification_preferences ?? [];
            if (! ($preferences['daily_summary_enabled'] ?? true)) {
                return false;
            }

            // Check if in silence period
            if ($this->isInSilencePeriod($user)) {
                return false;
            }

            // Get primary station
            $stationId = $preferences['primary_station_id'] ?? null;
            if (! $stationId) {
                // Try to get default station
                $defaultStation = $user->stations()
                    ->wherePivot('is_default', true)
                    ->first();

                if (! $defaultStation) {
                    Log::warning('User has no primary station for daily summary', ['user_id' => $user->id]);

                    return false;
                }

                $stationId = $defaultStation->id;
            }

            $station = Station::find($stationId);
            if (! $station) {
                return false;
            }

            // Generate summary content
            $summary = $this->generateDailySummary($user, $station);

            // Send via Telegram
            Telegram::sendMessage([
                'chat_id' => $user->telegram_chat_id,
                'text' => $summary,
                'parse_mode' => 'Markdown',
            ]);

            // Log successful send
            Log::info('Daily summary sent', [
                'user_id' => $user->id,
                'station_id' => $station->id,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Failed to send daily summary', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send price alert to a user
     */
    public function sendPriceAlert(User $user, Station $station, array $priceChanges): bool
    {
        try {
            // Check if user has telegram chat ID
            if (! $user->telegram_chat_id) {
                return false;
            }

            // Check if price alerts are enabled
            $preferences = $user->notification_preferences ?? [];
            if (! ($preferences['price_alerts_enabled'] ?? true)) {
                return false;
            }

            // Check if in silence period
            if ($this->isInSilencePeriod($user)) {
                return false;
            }

            // Check alert frequency
            if (! $this->shouldSendAlert($user, 'price_alert')) {
                return false;
            }

            // Generate alert content
            $alert = $this->generatePriceAlert($user, $station, $priceChanges);

            // Send via Telegram
            Telegram::sendMessage([
                'chat_id' => $user->telegram_chat_id,
                'text' => $alert,
                'parse_mode' => 'Markdown',
            ]);

            // Update last alert time
            $this->updateLastAlertTime($user, 'price_alert');

            // Log successful send
            Log::info('Price alert sent', [
                'user_id' => $user->id,
                'station_id' => $station->id,
                'changes' => $priceChanges,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Failed to send price alert', [
                'user_id' => $user->id,
                'station_id' => $station->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send recommendation to a user
     */
    public function sendRecommendation(User $user, string $recommendation): bool
    {
        try {
            // Check if user has telegram chat ID
            if (! $user->telegram_chat_id) {
                return false;
            }

            // Check if recommendations are enabled
            $preferences = $user->notification_preferences ?? [];
            if (! ($preferences['recommendations_enabled'] ?? true)) {
                return false;
            }

            // Check if in silence period
            if ($this->isInSilencePeriod($user)) {
                return false;
            }

            // Check recommendation frequency
            if (! $this->shouldSendRecommendation($user)) {
                return false;
            }

            // Format recommendation
            $message = "💡 **Recomendación Inteligente**\n\n";
            $message .= $recommendation;
            $message .= "\n\n_Basado en tu historial y preferencias_";

            // Send via Telegram
            Telegram::sendMessage([
                'chat_id' => $user->telegram_chat_id,
                'text' => $message,
                'parse_mode' => 'Markdown',
            ]);

            // Update last recommendation time
            $this->updateLastRecommendationTime($user);

            // Log successful send
            Log::info('Recommendation sent', [
                'user_id' => $user->id,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Failed to send recommendation', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Generate daily summary content
     */
    private function generateDailySummary(User $user, Station $station): string
    {
        $now = Carbon::now('America/Mexico_City');
        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot('alias')
            ->first();

        $stationAlias = $userStation->pivot->alias ?? $station->nombre;

        // Get current prices
        $prices = PriceChange::where('station_id', $station->id)
            ->whereIn('fuel_type', ['regular', 'premium', 'diesel'])
            ->orderBy('fuel_type')
            ->get()
            ->groupBy('fuel_type')
            ->map(function ($group) {
                return $group->sortByDesc('changed_at')->first();
            });

        // Format prices for template
        $formattedPrices = [];
        foreach (['regular', 'premium', 'diesel'] as $type) {
            if (isset($prices[$type])) {
                $price = $prices[$type];

                // Get price change
                $previousPrice = PriceChange::where('station_id', $station->id)
                    ->where('fuel_type', $type)
                    ->where('changed_at', '<', $price->changed_at)
                    ->orderBy('changed_at', 'desc')
                    ->first();

                $indicator = '➡️';
                $changeText = 'Sin cambio';

                if ($previousPrice) {
                    $change = $price->price - $previousPrice->price;
                    $changePercent = ($change / $previousPrice->price) * 100;

                    if ($change > 0) {
                        $indicator = '📈';
                        $changeText = sprintf('+%.2f%%', $changePercent);
                    } elseif ($change < 0) {
                        $indicator = '📉';
                        $changeText = sprintf('%.2f%%', $changePercent);
                    }
                }

                $formattedPrices[$type] = [
                    'price' => $price->price,
                    'indicator' => $indicator,
                    'change' => $changeText,
                ];
            }
        }

        // Get competitive position
        $preferences = $user->notification_preferences ?? [];
        $radius = $preferences['alert_radius_km'] ?? 5;

        $analytics = $this->analyticsService->getStationAnalytics($station->id, $radius);
        $ranking = $analytics && isset($analytics['ranking']) ? $analytics['ranking']['summary'] : null;

        // Get recommendation
        $recommendation = $this->generateSmartRecommendation($user, $station, $prices);

        // Render template
        return View::make('telegram.daily-summary', [
            'station_alias' => $stationAlias,
            'date' => $now->format('d/m/Y'),
            'prices' => $formattedPrices,
            'ranking' => $ranking,
            'trend_analysis' => null, // Could be added from analytics
            'recommendation' => $recommendation,
            'nearby_stations' => [], // Could be added
            'savings_opportunity' => null, // Could be calculated
        ])->render();
    }

    /**
     * Generate price alert content
     */
    private function generatePriceAlert(User $user, Station $station, array $priceChanges): string
    {
        $userStation = $user->stations()
            ->where('station_id', $station->id)
            ->withPivot('alias')
            ->first();

        $stationAlias = $userStation->pivot->alias ?? $station->nombre;

        $message = "🚨 **Alerta de Cambio de Precio**\n\n";
        $message .= "📍 Estación: {$stationAlias}\n";
        $message .= '⏰ '.Carbon::now('America/Mexico_City')->format('d/m/Y H:i')."\n\n";

        $message .= "💰 **Cambios detectados:**\n";

        foreach ($priceChanges as $change) {
            $fuelType = ucfirst($change['fuel_type']);
            $oldPrice = sprintf('$%.2f', $change['old_price']);
            $newPrice = sprintf('$%.2f', $change['new_price']);
            $difference = $change['new_price'] - $change['old_price'];
            $percentage = ($difference / $change['old_price']) * 100;

            if ($difference > 0) {
                $emoji = '📈';
                $changeText = sprintf('+$%.2f (+%.1f%%)', $difference, $percentage);
            } else {
                $emoji = '📉';
                $changeText = sprintf('-$%.2f (%.1f%%)', abs($difference), $percentage);
            }

            $message .= "{$emoji} {$fuelType}: {$oldPrice} → {$newPrice} ({$changeText})\n";
        }

        // Add context
        $preferences = $user->notification_preferences ?? [];
        $radius = $preferences['alert_radius_km'] ?? 5;

        $competitorAnalysis = $this->analyzeCompetitorPrices($station, $radius);
        if ($competitorAnalysis) {
            $message .= "\n📊 **Comparación con competencia:**\n";
            $message .= $competitorAnalysis;
        }

        $message .= "\n_Usa /precios para ver más detalles_";

        return $message;
    }

    /**
     * Generate smart recommendation based on user data
     */
    private function generateSmartRecommendation(User $user, Station $station, $prices): ?string
    {
        // This would integrate with DeepSeek or another AI service
        // For now, return a simple recommendation

        $dayOfWeek = Carbon::now('America/Mexico_City')->dayOfWeek;
        $hour = Carbon::now('America/Mexico_City')->hour;

        $recommendations = [
            'Considera cargar combustible hoy, los precios suelen subir los fines de semana.',
            'Los precios están estables esta semana. No hay urgencia para cargar.',
            'Detectamos una tendencia alcista. Recomendamos cargar pronto.',
            'Hay estaciones más económicas a {radius}km. Usa /competencia para verlas.',
            'Tu estación tiene precios competitivos comparado con el promedio de la zona.',
        ];

        // Simple logic for demo
        if ($dayOfWeek >= 4 && $dayOfWeek <= 5) { // Thursday or Friday
            return $recommendations[0];
        }

        return $recommendations[array_rand($recommendations)];
    }

    /**
     * Check if user is in silence period
     */
    private function isInSilencePeriod(User $user): bool
    {
        $preferences = $user->notification_preferences ?? [];

        if (! isset($preferences['silence_until'])) {
            return false;
        }

        $silenceUntil = Carbon::parse($preferences['silence_until']);

        return $silenceUntil->isFuture();
    }

    /**
     * Check if should send alert based on frequency
     */
    private function shouldSendAlert(User $user, string $alertType): bool
    {
        $preferences = $user->notification_preferences ?? [];
        $frequency = $preferences['alert_frequency'] ?? 'instant';

        if ($frequency === 'instant') {
            return true;
        }

        $cacheKey = "user:last_alert:{$user->id}:{$alertType}";
        $lastSent = Cache::get($cacheKey);

        if (! $lastSent) {
            return true;
        }

        $lastSentTime = Carbon::parse($lastSent);
        $now = Carbon::now();

        switch ($frequency) {
            case 'hourly':
                return $lastSentTime->diffInHours($now) >= 1;
            case 'daily':
                return $lastSentTime->diffInDays($now) >= 1;
            case 'weekly':
                return $lastSentTime->diffInWeeks($now) >= 1;
            default:
                return true;
        }
    }

    /**
     * Check if should send recommendation based on frequency
     */
    private function shouldSendRecommendation(User $user): bool
    {
        $preferences = $user->notification_preferences ?? [];
        $frequency = $preferences['recommendation_frequency'] ?? 'daily';

        $cacheKey = "user:last_recommendation:{$user->id}";
        $lastSent = Cache::get($cacheKey);

        if (! $lastSent) {
            return true;
        }

        $lastSentTime = Carbon::parse($lastSent);
        $now = Carbon::now();

        switch ($frequency) {
            case 'daily':
                return $lastSentTime->diffInDays($now) >= 1;
            case 'weekly':
                return $lastSentTime->diffInWeeks($now) >= 1;
            case 'biweekly':
                return $lastSentTime->diffInDays($now) >= 14;
            case 'monthly':
                return $lastSentTime->diffInMonths($now) >= 1;
            default:
                return true;
        }
    }

    /**
     * Update last alert time
     */
    private function updateLastAlertTime(User $user, string $alertType): void
    {
        $cacheKey = "user:last_alert:{$user->id}:{$alertType}";
        Cache::put($cacheKey, Carbon::now()->toIso8601String(), 86400 * 30); // 30 days TTL
    }

    /**
     * Update last recommendation time
     */
    private function updateLastRecommendationTime(User $user): void
    {
        $cacheKey = "user:last_recommendation:{$user->id}";
        Cache::put($cacheKey, Carbon::now()->toIso8601String(), 86400 * 30); // 30 days TTL
    }

    /**
     * Analyze competitor prices for context
     */
    private function analyzeCompetitorPrices(Station $station, int $radius): ?string
    {
        // Get nearby stations
        $nearbyStations = Station::selectRaw(
            '*, ST_Distance_Sphere(location, ?) as distance',
            [$station->location]
        )
            ->where('id', '!=', $station->id)
            ->having('distance', '<=', $radius * 1000)
            ->orderBy('distance')
            ->limit(5)
            ->get();

        if ($nearbyStations->isEmpty()) {
            return null;
        }

        // Get current prices for comparison
        $stationPrice = PriceChange::where('station_id', $station->id)
            ->where('fuel_type', 'regular')
            ->orderBy('changed_at', 'desc')
            ->first();

        if (! $stationPrice) {
            return null;
        }

        $cheaper = 0;
        $moreExpensive = 0;

        foreach ($nearbyStations as $nearbyStation) {
            $nearbyPrice = PriceChange::where('station_id', $nearbyStation->id)
                ->where('fuel_type', 'regular')
                ->orderBy('changed_at', 'desc')
                ->first();

            if ($nearbyPrice) {
                if ($nearbyPrice->price < $stationPrice->price) {
                    $cheaper++;
                } else {
                    $moreExpensive++;
                }
            }
        }

        if ($cheaper > 0) {
            return "Hay {$cheaper} estaciones más económicas cerca.";
        } elseif ($moreExpensive > 0) {
            return "Tu estación tiene mejor precio que {$moreExpensive} estaciones cercanas.";
        }

        return 'Tu estación tiene precios promedio en la zona.';
    }
}
