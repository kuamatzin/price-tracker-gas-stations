<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Station extends Model
{
    use HasFactory;

    protected $primaryKey = 'numero';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'numero',
        'nombre',
        'direccion',
        'lat',
        'lng',
        'entidad_id',
        'municipio_id',
        'brand',
        'is_active',
    ];

    protected $casts = [
        'lat' => 'decimal:8',
        'lng' => 'decimal:8',
        'is_active' => 'boolean',
    ];

    public function municipio()
    {
        return $this->belongsTo(Municipio::class, 'municipio_id', 'id');
    }

    public function users()
    {
        return $this->belongsToMany(
            User::class,
            'user_stations',
            'station_numero',
            'user_id',
            'numero',
            'id'
        )->withPivot('role')->withTimestamps();
    }

    public function priceChanges()
    {
        return $this->hasMany(PriceChange::class, 'station_numero', 'numero');
    }

    /**
     * Scope a query to only include stations for a specific user.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int|string  $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForUser($query, $userId)
    {
        return $query->whereHas('users', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }

    /**
     * Scope a query to only include stations with a specific role for a user.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int|string  $userId
     * @param  string  $role
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForUserWithRole($query, $userId, string $role)
    {
        return $query->whereHas('users', function ($q) use ($userId, $role) {
            $q->where('user_id', $userId)
                ->where('user_stations.role', $role);
        });
    }

    /**
     * Scope a query to only include active stations.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to only include stations within a geographic area.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  float  $lat
     * @param  float  $lng
     * @param  float  $radiusKm
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeWithinRadius($query, float $lat, float $lng, float $radiusKm = 5)
    {
        // Use whereRaw for SQLite compatibility in tests
        $haversine = "(6371 * 2 * ASIN(SQRT(
            POW(SIN((? - ABS(lat)) * PI() / 180 / 2), 2) +
            COS(? * PI() / 180) * COS(ABS(lat) * PI() / 180) *
            POW(SIN((? - lng) * PI() / 180 / 2), 2)
        )))";
        
        return $query->selectRaw("*, {$haversine} AS distance", [$lat, $lat, $lng])
            ->whereRaw("{$haversine} <= ?", [$lat, $lat, $lng, $radiusKm])
            ->orderBy('distance');
    }
}
