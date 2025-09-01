<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UserPreferenceRepository
{
    /**
     * Get user preferences with caching
     */
    public function getPreferences(User $user): array
    {
        $cacheKey = "user:preferences:{$user->id}";

        return Cache::remember($cacheKey, 300, function () use ($user) {
            return $user->notification_preferences ?? $this->getDefaultPreferences();
        });
    }

    /**
     * Update user preferences with validation
     */
    public function updatePreferences(User $user, array $preferences): array
    {
        // Validate preferences
        $validated = $this->validatePreferences($preferences);

        // Merge with existing preferences
        $existingPreferences = $user->notification_preferences ?? [];
        $mergedPreferences = array_merge($existingPreferences, $validated);

        // Update user
        $user->notification_preferences = $mergedPreferences;
        $user->save();

        // Clear cache
        $this->clearPreferencesCache($user);

        return $mergedPreferences;
    }

    /**
     * Get notification settings
     */
    public function getNotificationSettings(User $user): array
    {
        $preferences = $this->getPreferences($user);

        return [
            'daily_summary_enabled' => $preferences['daily_summary_enabled'] ?? true,
            'daily_summary_time' => $preferences['daily_summary_time'] ?? '07:00',
            'price_alerts_enabled' => $preferences['price_alerts_enabled'] ?? true,
            'alert_frequency' => $preferences['alert_frequency'] ?? 'instant',
            'recommendations_enabled' => $preferences['recommendations_enabled'] ?? true,
            'recommendation_frequency' => $preferences['recommendation_frequency'] ?? 'daily',
            'telegram_enabled' => $preferences['telegram_enabled'] ?? true,
            'email_enabled' => $preferences['email_enabled'] ?? false,
            'silence_until' => $preferences['silence_until'] ?? null,
        ];
    }

    /**
     * Update notification settings
     */
    public function updateNotificationSettings(User $user, array $settings): array
    {
        $validSettings = $this->validateNotificationSettings($settings);

        return $this->updatePreferences($user, $validSettings);
    }

    /**
     * Get alert thresholds
     */
    public function getAlertThresholds(User $user): array
    {
        $preferences = $this->getPreferences($user);

        return [
            'price_change_threshold' => $preferences['price_change_threshold'] ?? 2.0,
            'threshold_type' => $preferences['threshold_type'] ?? 'percentage',
            'threshold_amount' => $preferences['threshold_amount'] ?? null,
            'fuel_type_thresholds' => $preferences['fuel_type_thresholds'] ?? [],
            'alert_radius_km' => $preferences['alert_radius_km'] ?? 5,
        ];
    }

    /**
     * Update alert thresholds
     */
    public function updateAlertThresholds(User $user, array $thresholds): array
    {
        $validThresholds = $this->validateThresholds($thresholds);

        return $this->updatePreferences($user, $validThresholds);
    }

    /**
     * Set fuel type specific threshold
     */
    public function setFuelTypeThreshold(User $user, string $fuelType, float $threshold): array
    {
        $preferences = $this->getPreferences($user);

        if (! in_array($fuelType, ['regular', 'premium', 'diesel'])) {
            throw new \InvalidArgumentException("Invalid fuel type: {$fuelType}");
        }

        $fuelTypeThresholds = $preferences['fuel_type_thresholds'] ?? [];
        $fuelTypeThresholds[$fuelType] = $threshold;

        return $this->updatePreferences($user, [
            'fuel_type_thresholds' => $fuelTypeThresholds,
        ]);
    }

    /**
     * Get monitoring preferences
     */
    public function getMonitoringPreferences(User $user): array
    {
        $preferences = $this->getPreferences($user);

        return [
            'primary_station_id' => $preferences['primary_station_id'] ?? null,
            'alert_radius_km' => $preferences['alert_radius_km'] ?? 5,
            'fuel_types' => $preferences['fuel_types'] ?? ['regular', 'premium', 'diesel'],
            'competitor_monitoring' => $preferences['competitor_monitoring'] ?? true,
            'market_trend_alerts' => $preferences['market_trend_alerts'] ?? false,
        ];
    }

    /**
     * Update monitoring preferences
     */
    public function updateMonitoringPreferences(User $user, array $monitoring): array
    {
        $validMonitoring = $this->validateMonitoringPreferences($monitoring);

        return $this->updatePreferences($user, $validMonitoring);
    }

    /**
     * Set silence period
     */
    public function setSilencePeriod(User $user, ?\DateTime $until): array
    {
        $silenceUntil = $until ? $until->format('Y-m-d H:i:s') : null;

        return $this->updatePreferences($user, [
            'silence_until' => $silenceUntil,
        ]);
    }

    /**
     * Clear silence period
     */
    public function clearSilencePeriod(User $user): array
    {
        $preferences = $this->getPreferences($user);
        unset($preferences['silence_until']);

        $user->notification_preferences = $preferences;
        $user->save();

        $this->clearPreferencesCache($user);

        return $preferences;
    }

    /**
     * Check if user is in silence period
     */
    public function isInSilencePeriod(User $user): bool
    {
        $preferences = $this->getPreferences($user);

        if (! isset($preferences['silence_until'])) {
            return false;
        }

        $silenceUntil = new \DateTime($preferences['silence_until']);
        $now = new \DateTime;

        return $silenceUntil > $now;
    }

    /**
     * Get default preferences
     */
    private function getDefaultPreferences(): array
    {
        return [
            'daily_summary_enabled' => true,
            'daily_summary_time' => '07:00',
            'price_alerts_enabled' => true,
            'alert_frequency' => 'instant',
            'recommendations_enabled' => true,
            'recommendation_frequency' => 'daily',
            'telegram_enabled' => true,
            'email_enabled' => false,
            'price_change_threshold' => 2.0,
            'threshold_type' => 'percentage',
            'alert_radius_km' => 5,
            'fuel_types' => ['regular', 'premium', 'diesel'],
            'competitor_monitoring' => true,
            'market_trend_alerts' => false,
        ];
    }

    /**
     * Validate preferences
     */
    private function validatePreferences(array $preferences): array
    {
        $rules = [
            'daily_summary_enabled' => 'sometimes|boolean',
            'daily_summary_time' => 'sometimes|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'price_alerts_enabled' => 'sometimes|boolean',
            'alert_frequency' => 'sometimes|in:instant,hourly,daily,weekly',
            'recommendations_enabled' => 'sometimes|boolean',
            'recommendation_frequency' => 'sometimes|in:daily,weekly,biweekly,monthly',
            'telegram_enabled' => 'sometimes|boolean',
            'email_enabled' => 'sometimes|boolean',
            'price_change_threshold' => 'sometimes|numeric|min:0.1|max:20',
            'threshold_type' => 'sometimes|in:percentage,amount',
            'threshold_amount' => 'sometimes|numeric|min:0.1|max:10',
            'alert_radius_km' => 'sometimes|numeric|min:1|max:20',
            'fuel_types' => 'sometimes|array',
            'fuel_types.*' => 'in:regular,premium,diesel',
            'primary_station_id' => 'sometimes|integer|exists:stations,id',
            'competitor_monitoring' => 'sometimes|boolean',
            'market_trend_alerts' => 'sometimes|boolean',
            'silence_until' => 'sometimes|nullable|date',
            'fuel_type_thresholds' => 'sometimes|array',
            'fuel_type_thresholds.regular' => 'sometimes|numeric|min:0.1|max:20',
            'fuel_type_thresholds.premium' => 'sometimes|numeric|min:0.1|max:20',
            'fuel_type_thresholds.diesel' => 'sometimes|numeric|min:0.1|max:20',
        ];

        $validator = Validator::make($preferences, $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate notification settings
     */
    private function validateNotificationSettings(array $settings): array
    {
        $rules = [
            'daily_summary_enabled' => 'sometimes|boolean',
            'daily_summary_time' => 'sometimes|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'price_alerts_enabled' => 'sometimes|boolean',
            'alert_frequency' => 'sometimes|in:instant,hourly,daily,weekly',
            'recommendations_enabled' => 'sometimes|boolean',
            'recommendation_frequency' => 'sometimes|in:daily,weekly,biweekly,monthly',
            'telegram_enabled' => 'sometimes|boolean',
            'email_enabled' => 'sometimes|boolean',
            'silence_until' => 'sometimes|nullable|date',
        ];

        $validator = Validator::make($settings, $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate thresholds
     */
    private function validateThresholds(array $thresholds): array
    {
        $rules = [
            'price_change_threshold' => 'sometimes|numeric|min:0.1|max:20',
            'threshold_type' => 'sometimes|in:percentage,amount',
            'threshold_amount' => 'sometimes|numeric|min:0.1|max:10',
            'alert_radius_km' => 'sometimes|numeric|min:1|max:20',
            'fuel_type_thresholds' => 'sometimes|array',
            'fuel_type_thresholds.regular' => 'sometimes|numeric|min:0.1|max:20',
            'fuel_type_thresholds.premium' => 'sometimes|numeric|min:0.1|max:20',
            'fuel_type_thresholds.diesel' => 'sometimes|numeric|min:0.1|max:20',
        ];

        $validator = Validator::make($thresholds, $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate monitoring preferences
     */
    private function validateMonitoringPreferences(array $monitoring): array
    {
        $rules = [
            'primary_station_id' => 'sometimes|integer|exists:stations,id',
            'alert_radius_km' => 'sometimes|numeric|min:1|max:20',
            'fuel_types' => 'sometimes|array',
            'fuel_types.*' => 'in:regular,premium,diesel',
            'competitor_monitoring' => 'sometimes|boolean',
            'market_trend_alerts' => 'sometimes|boolean',
        ];

        $validator = Validator::make($monitoring, $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Clear preferences cache
     */
    private function clearPreferencesCache(User $user): void
    {
        Cache::forget("user:preferences:{$user->id}");
    }

    /**
     * Get users by notification time
     */
    public function getUsersByNotificationTime(string $time): \Illuminate\Database\Eloquent\Collection
    {
        return User::whereNotNull('telegram_chat_id')
            ->whereJsonContains('notification_preferences->daily_summary_enabled', true)
            ->whereJsonContains('notification_preferences->daily_summary_time', $time)
            ->get();
    }

    /**
     * Get users with price alerts enabled
     */
    public function getUsersWithPriceAlertsEnabled(): \Illuminate\Database\Eloquent\Collection
    {
        return User::whereNotNull('telegram_chat_id')
            ->whereJsonContains('notification_preferences->price_alerts_enabled', true)
            ->get();
    }
}
