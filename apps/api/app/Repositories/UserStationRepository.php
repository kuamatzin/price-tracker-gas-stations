<?php

namespace App\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UserStationRepository
{
    /**
     * Get user stations with full station details
     */
    public function getUserStationsWithDetails(int $userId): Collection
    {
        return DB::table('user_stations as us')
            ->join('stations as s', 's.numero', '=', 'us.station_numero')
            ->leftJoin('municipios as m', 'm.id', '=', 's.municipio_id')
            ->select([
                'us.id',
                'us.alias',
                'us.is_default',
                'us.station_numero',
                's.nombre',
                's.direccion',
                's.lat',
                's.lng',
                's.brand',
                's.municipio_id',
                'm.nombre as municipio_nombre',
            ])
            ->where('us.user_id', $userId)
            ->where('s.is_active', true)
            ->orderBy('us.is_default', 'desc')
            ->orderBy('us.alias')
            ->get();
    }

    /**
     * Find user station by alias
     */
    public function findByUserAndAlias(int $userId, string $alias)
    {
        return DB::table('user_stations')
            ->where('user_id', $userId)
            ->where('alias', $alias)
            ->first();
    }

    /**
     * Set default station for user
     */
    public function setDefaultStation(int $userId, int $userStationId): bool
    {
        DB::beginTransaction();

        try {
            // Clear existing defaults
            DB::table('user_stations')
                ->where('user_id', $userId)
                ->update(['is_default' => false]);

            // Set new default
            DB::table('user_stations')
                ->where('id', $userStationId)
                ->where('user_id', $userId)
                ->update(['is_default' => true]);

            DB::commit();

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Register a new station for user
     */
    public function registerStation(int $userId, string $stationNumero, string $alias): int
    {
        // Check if alias already exists for this user
        $existing = $this->findByUserAndAlias($userId, $alias);
        if ($existing) {
            throw new \Exception("Ya tienes una estación registrada con el alias '{$alias}'");
        }

        // Check if this is the first station for the user
        $isFirstStation = DB::table('user_stations')
            ->where('user_id', $userId)
            ->count() === 0;

        return DB::table('user_stations')->insertGetId([
            'user_id' => $userId,
            'station_numero' => $stationNumero,
            'alias' => $alias,
            'is_default' => $isFirstStation, // Auto-set as default if first station
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Remove user station
     */
    public function removeStation(int $userId, int $userStationId): bool
    {
        return DB::table('user_stations')
            ->where('id', $userStationId)
            ->where('user_id', $userId)
            ->delete() > 0;
    }
}
