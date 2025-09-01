<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertConfiguration extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'type',
        'conditions',
        'is_active',
        'last_triggered_at'
    ];

    protected $casts = [
        'conditions' => 'array',
        'is_active' => 'boolean',
        'last_triggered_at' => 'datetime'
    ];

    /**
     * Get the user that owns the alert configuration
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to get active alerts
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get alerts ready to be triggered (respecting cooldown)
     */
    public function scopeReadyToTrigger($query, $cooldownMinutes = 60)
    {
        $cutoffTime = now()->subMinutes($cooldownMinutes);
        
        return $query->active()
            ->where(function ($q) use ($cutoffTime) {
                $q->whereNull('last_triggered_at')
                  ->orWhere('last_triggered_at', '<=', $cutoffTime);
            });
    }

    /**
     * Check if alert is in cooldown period
     */
    public function isInCooldown($minutes = 60): bool
    {
        if (!$this->last_triggered_at) {
            return false;
        }

        return $this->last_triggered_at->addMinutes($minutes)->isFuture();
    }

    /**
     * Mark alert as triggered
     */
    public function markAsTriggered(): void
    {
        $this->update(['last_triggered_at' => now()]);
    }

    /**
     * Check if price change exceeds threshold
     */
    public function exceedsThreshold(float $oldPrice, float $newPrice, string $fuelType = null): bool
    {
        $conditions = $this->conditions;
        
        // Check if fuel type matches (if specified)
        if ($fuelType && isset($conditions['fuel_types'])) {
            if (!in_array($fuelType, $conditions['fuel_types'])) {
                return false;
            }
        }
        
        // Check fuel-specific threshold first
        if ($fuelType && isset($conditions['fuel_type_thresholds'][$fuelType])) {
            $threshold = $conditions['fuel_type_thresholds'][$fuelType];
        } else {
            // Use general threshold
            $threshold = $conditions['threshold_percentage'] ?? $conditions['price_change_threshold'] ?? 0;
        }
        
        if ($threshold <= 0) {
            return false;
        }
        
        // Calculate change based on threshold type
        $thresholdType = $conditions['threshold_type'] ?? 'percentage';
        
        if ($thresholdType === 'percentage') {
            $changePercent = abs(($newPrice - $oldPrice) / $oldPrice * 100);
            return $changePercent >= $threshold;
        } else {
            // Absolute amount threshold
            $changeAmount = abs($newPrice - $oldPrice);
            $amountThreshold = $conditions['threshold_amount'] ?? $threshold;
            return $changeAmount >= $amountThreshold;
        }
    }

    /**
     * Get formatted threshold description
     */
    public function getThresholdDescription(): string
    {
        $conditions = $this->conditions;
        $thresholdType = $conditions['threshold_type'] ?? 'percentage';
        
        if ($thresholdType === 'percentage') {
            $threshold = $conditions['threshold_percentage'] ?? $conditions['price_change_threshold'] ?? 0;
            return "{$threshold}%";
        } else {
            $amount = $conditions['threshold_amount'] ?? 0;
            return "$" . number_format($amount, 2);
        }
    }

    /**
     * Create default price alert for user
     */
    public static function createDefaultForUser(User $user): self
    {
        $preferences = $user->notification_preferences ?? [];
        
        return self::create([
            'user_id' => $user->id,
            'name' => 'Alerta de Cambio de Precio',
            'type' => 'price_change',
            'conditions' => [
                'threshold_percentage' => $preferences['price_change_threshold'] ?? 2.0,
                'threshold_type' => $preferences['threshold_type'] ?? 'percentage',
                'fuel_types' => $preferences['fuel_types'] ?? ['regular', 'premium', 'diesel'],
                'radius_km' => $preferences['alert_radius_km'] ?? 5,
                'stations' => $preferences['monitored_stations'] ?? []
            ],
            'is_active' => true
        ]);
    }

    /**
     * Sync with user preferences
     */
    public function syncWithUserPreferences(): void
    {
        $preferences = $this->user->notification_preferences ?? [];
        
        $conditions = $this->conditions;
        $conditions['threshold_percentage'] = $preferences['price_change_threshold'] ?? $conditions['threshold_percentage'] ?? 2.0;
        $conditions['threshold_type'] = $preferences['threshold_type'] ?? $conditions['threshold_type'] ?? 'percentage';
        $conditions['threshold_amount'] = $preferences['threshold_amount'] ?? $conditions['threshold_amount'] ?? null;
        $conditions['fuel_types'] = $preferences['fuel_types'] ?? $conditions['fuel_types'] ?? ['regular', 'premium', 'diesel'];
        $conditions['fuel_type_thresholds'] = $preferences['fuel_type_thresholds'] ?? $conditions['fuel_type_thresholds'] ?? [];
        $conditions['radius_km'] = $preferences['alert_radius_km'] ?? $conditions['radius_km'] ?? 5;
        
        $this->update(['conditions' => $conditions]);
    }
}