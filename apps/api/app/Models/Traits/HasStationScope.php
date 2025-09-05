<?php

namespace App\Models\Traits;

/**
 * Trait HasStationScope
 * 
 * Provides common station-specific query scopes for models that belong to stations
 */
trait HasStationScope
{
    /**
     * Scope a query to only include records for a specific station.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $stationNumero
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForStation($query, string $stationNumero)
    {
        return $query->where($this->getStationForeignKey(), $stationNumero);
    }

    /**
     * Scope a query to only include records for multiple stations.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  array  $stationNumeros
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForStations($query, array $stationNumeros)
    {
        return $query->whereIn($this->getStationForeignKey(), $stationNumeros);
    }

    /**
     * Scope a query to only include records for a user's stations.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  int|string  $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForUserStations($query, $userId)
    {
        $stationNumeros = \App\Models\User::find($userId)
            ->stations()
            ->pluck('numero')
            ->toArray();
        
        if (empty($stationNumeros)) {
            return $query->whereRaw('1 = 0'); // Return no results
        }

        return $query->forStations($stationNumeros);
    }

    /**
     * Get the foreign key name for the station relationship.
     * Override this method in the model if using a different column name.
     *
     * @return string
     */
    protected function getStationForeignKey(): string
    {
        return 'station_numero';
    }
}