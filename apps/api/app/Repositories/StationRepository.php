<?php

namespace App\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StationRepository
{
    /**
     * Find station by numero
     */
    public function findByNumero(string $numero)
    {
        return DB::table('stations')
            ->where('numero', $numero)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Search stations by name
     */
    public function searchByName(string $searchTerm, int $limit = 10): Collection
    {
        return DB::table('stations')
            ->where('is_active', true)
            ->where(function ($query) use ($searchTerm) {
                $query->where('nombre', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('direccion', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('brand', 'LIKE', "%{$searchTerm}%");
            })
            ->limit($limit)
            ->get();
    }

    /**
     * Get nearby stations
     */
    public function getNearbyStations(
        float $lat,
        float $lng,
        float $radiusKm = 5,
        ?string $excludeNumero = null
    ): Collection {
        $query = DB::table('stations')
            ->select([
                '*',
                DB::raw('(6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
                        cos(radians(lng) - radians(?)) + sin(radians(?)) * 
                        sin(radians(lat)))) as distance'),
            ])
            ->addBinding([$lat, $lng, $lat], 'select')
            ->where('is_active', true)
            ->having('distance', '<=', $radiusKm)
            ->orderBy('distance');

        if ($excludeNumero) {
            $query->where('numero', '!=', $excludeNumero);
        }

        return $query->limit(20)->get();
    }

    /**
     * Get stations by municipality
     */
    public function getByMunicipality(int $municipioId): Collection
    {
        return DB::table('stations')
            ->where('municipio_id', $municipioId)
            ->where('is_active', true)
            ->orderBy('nombre')
            ->get();
    }

    /**
     * Get station count by brand
     */
    public function getCountByBrand(): Collection
    {
        return DB::table('stations')
            ->select('brand', DB::raw('COUNT(*) as count'))
            ->where('is_active', true)
            ->whereNotNull('brand')
            ->groupBy('brand')
            ->orderBy('count', 'desc')
            ->get();
    }
}
