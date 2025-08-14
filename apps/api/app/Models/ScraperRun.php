<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScraperRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'started_at',
        'completed_at',
        'status',
        'statistics',
        'errors',
        'duration_seconds',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'statistics' => 'array',
        'errors' => 'array',
    ];

    /**
     * Scope for successful runs
     */
    public function scopeSuccessful($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope for failed runs
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Get the last successful run
     */
    public static function lastSuccessful()
    {
        return static::successful()
            ->orderBy('completed_at', 'desc')
            ->first();
    }

    /**
     * Calculate duration in seconds
     */
    public function calculateDuration(): int
    {
        if (!$this->started_at || !$this->completed_at) {
            return 0;
        }

        return $this->completed_at->diffInSeconds($this->started_at);
    }
}