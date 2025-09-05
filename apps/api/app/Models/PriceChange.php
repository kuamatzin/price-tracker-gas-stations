<?php

namespace App\Models;

use App\Models\Traits\HasStationScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PriceChange extends Model
{
    use HasFactory, HasStationScope;

    public $timestamps = false;

    protected $fillable = [
        'station_numero',
        'fuel_type',
        'subproducto',
        'price',
        'changed_at',
        'detected_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'changed_at' => 'datetime',
        'detected_at' => 'datetime',
    ];

    public function station()
    {
        return $this->belongsTo(Station::class, 'station_numero', 'numero');
    }

    /**
     * Scope a query to only include recent price changes.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int  $days
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeRecent($query, int $days = 7)
    {
        return $query->where('changed_at', '>=', now()->subDays($days));
    }
}
