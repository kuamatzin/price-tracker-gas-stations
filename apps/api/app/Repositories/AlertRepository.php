<?php

namespace App\Repositories;

use App\Models\AlertConfiguration;
use Illuminate\Support\Collection;

class AlertRepository
{
    /**
     * Create a new alert configuration
     */
    public function create(array $data): AlertConfiguration
    {
        return AlertConfiguration::create($data);
    }

    /**
     * Update an alert configuration
     */
    public function update(int $id, array $data): bool
    {
        return AlertConfiguration::where('id', $id)->update($data);
    }

    /**
     * Delete an alert configuration
     */
    public function delete(int $id): bool
    {
        return AlertConfiguration::where('id', $id)->delete();
    }

    /**
     * Get all alerts for a user
     */
    public function getUserAlerts(int $userId): Collection
    {
        return AlertConfiguration::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get active alerts for a user
     */
    public function getActiveUserAlerts(int $userId): Collection
    {
        return AlertConfiguration::where('user_id', $userId)
            ->where('is_active', true)
            ->get();
    }

    /**
     * Get all active alerts for processing
     */
    public function getAllActiveAlerts(): Collection
    {
        return AlertConfiguration::where('is_active', true)
            ->with('user')
            ->get();
    }

    /**
     * Get alerts that haven't been triggered recently
     */
    public function getAlertsToProcess(int $cooldownMinutes = 60): Collection
    {
        $cutoffTime = now()->subMinutes($cooldownMinutes);

        return AlertConfiguration::where('is_active', true)
            ->where(function ($query) use ($cutoffTime) {
                $query->whereNull('last_triggered_at')
                    ->orWhere('last_triggered_at', '<=', $cutoffTime);
            })
            ->with('user')
            ->get();
    }

    /**
     * Mark alert as triggered
     */
    public function markAsTriggered(int $id): bool
    {
        return AlertConfiguration::where('id', $id)
            ->update(['last_triggered_at' => now()]);
    }

    /**
     * Check if alert should be triggered based on price changes
     */
    public function evaluatePriceChangeAlert(
        AlertConfiguration $alert,
        array $priceChanges
    ): bool {
        $conditions = $alert->conditions;
        $threshold = $conditions['threshold_percentage'] ?? 2.0;
        $fuelTypes = $conditions['fuel_types'] ?? ['regular', 'premium', 'diesel'];
        $comparisonType = $conditions['comparison_type'] ?? 'any';

        $triggered = false;

        foreach ($priceChanges as $change) {
            if (! in_array($change['fuel_type'], $fuelTypes)) {
                continue;
            }

            $changePercent = abs($change['change_percentage']);

            if ($changePercent >= $threshold) {
                if ($comparisonType === 'any') {
                    return true; // Any fuel type meeting threshold triggers
                }
                $triggered = true;
            } elseif ($comparisonType === 'all' && ! $triggered) {
                return false; // All fuel types must meet threshold
            }
        }

        return $comparisonType === 'all' ? $triggered : false;
    }

    /**
     * Check if alert should be triggered based on competitor moves
     */
    public function evaluateCompetitorMoveAlert(
        AlertConfiguration $alert,
        array $competitorChanges
    ): bool {
        $conditions = $alert->conditions;
        $threshold = $conditions['threshold_percentage'] ?? 2.0;
        $competitorStations = $conditions['competitor_stations'] ?? [];

        foreach ($competitorChanges as $change) {
            // If specific competitors are configured, check only those
            if (! empty($competitorStations) &&
                ! in_array($change['station_numero'], $competitorStations)) {
                continue;
            }

            if (abs($change['change_percentage']) >= $threshold) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if alert should be triggered based on market trends
     */
    public function evaluateMarketTrendAlert(
        AlertConfiguration $alert,
        array $marketData
    ): bool {
        $conditions = $alert->conditions;
        $threshold = $conditions['threshold_percentage'] ?? 2.0;
        $fuelTypes = $conditions['fuel_types'] ?? ['regular', 'premium', 'diesel'];

        foreach ($fuelTypes as $fuelType) {
            if (! isset($marketData[$fuelType])) {
                continue;
            }

            $trend = $marketData[$fuelType];

            // Check if trend change exceeds threshold
            if (abs($trend['change_percentage']) >= $threshold) {
                return true;
            }

            // Check for volatility (standard deviation)
            if (isset($trend['std_deviation']) &&
                $trend['std_deviation'] > $threshold) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get alert statistics for a user
     */
    public function getUserAlertStats(int $userId): array
    {
        $alerts = AlertConfiguration::where('user_id', $userId)->get();

        return [
            'total' => $alerts->count(),
            'active' => $alerts->where('is_active', true)->count(),
            'inactive' => $alerts->where('is_active', false)->count(),
            'triggered_today' => $alerts->where('last_triggered_at', '>=', now()->startOfDay())->count(),
            'types' => $alerts->groupBy('type')->map->count()->toArray(),
        ];
    }
}
