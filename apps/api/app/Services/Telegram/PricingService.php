<?php

namespace App\Services\Telegram;

use App\Repositories\PriceRepository;
use App\Repositories\StationRepository;
use App\Repositories\UserStationRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PricingService
{
    private PriceRepository $priceRepository;
    private StationRepository $stationRepository;
    private UserStationRepository $userStationRepository;

    public function __construct(
        PriceRepository $priceRepository,
        StationRepository $stationRepository,
        UserStationRepository $userStationRepository
    ) {
        $this->priceRepository = $priceRepository;
        $this->stationRepository = $stationRepository;
        $this->userStationRepository = $userStationRepository;
    }

    /**
     * Get user's registered stations with details
     */
    public function getUserStations(int $userId): Collection
    {
        $cacheKey = "telegram:user:{$userId}:stations";
        
        return Cache::remember($cacheKey, 3600, function () use ($userId) {
            return $this->userStationRepository->getUserStationsWithDetails($userId);
        });
    }

    /**
     * Get current prices for a specific station
     */
    public function getCurrentStationPrices(string $stationNumero, ?string $fuelType = null): Collection
    {
        $cacheKey = "telegram:prices:{$stationNumero}:" . ($fuelType ?? 'all');
        
        return Cache::remember($cacheKey, 300, function () use ($stationNumero, $fuelType) {
            $query = DB::table('price_changes as pc1')
                ->select('pc1.*')
                ->where('pc1.station_numero', $stationNumero)
                ->whereRaw('pc1.id = (
                    SELECT id FROM price_changes pc2 
                    WHERE pc2.station_numero = pc1.station_numero 
                    AND pc2.fuel_type = pc1.fuel_type 
                    ORDER BY pc2.changed_at DESC 
                    LIMIT 1
                )');

            if ($fuelType) {
                $query->where('pc1.fuel_type', $fuelType);
            }

            return $query->get();
        });
    }

    /**
     * Get prices for all user stations
     */
    public function getAllUserStationPrices(int $userId): Collection
    {
        $stations = $this->getUserStations($userId);
        
        return $stations->map(function ($station) {
            return [
                'station' => $station,
                'prices' => $this->getCurrentStationPrices($station->station_numero),
                'history' => $this->getPriceHistory($station->station_numero, 1)
            ];
        });
    }

    /**
     * Get nearby competitor prices
     */
    public function getNearbyCompetitorPrices(
        float $lat, 
        float $lng, 
        float $radiusKm = 5, 
        ?string $excludeNumero = null
    ): Collection {
        $cacheKey = "telegram:nearby:{$lat}:{$lng}:{$radiusKm}";
        
        return Cache::remember($cacheKey, 300, function () use ($lat, $lng, $radiusKm, $excludeNumero) {
            $query = DB::table('stations as s')
                ->select([
                    's.*',
                    DB::raw("(6371 * acos(cos(radians(?)) * cos(radians(s.lat)) * 
                            cos(radians(s.lng) - radians(?)) + sin(radians(?)) * 
                            sin(radians(s.lat)))) as distance")
                ])
                ->addBinding([$lat, $lng, $lat], 'select')
                ->where('s.is_active', true)
                ->having('distance', '<=', $radiusKm)
                ->orderBy('distance');

            if ($excludeNumero) {
                $query->where('s.numero', '!=', $excludeNumero);
            }

            $stations = $query->limit(20)->get();

            // Add current prices to each station
            foreach ($stations as $station) {
                $prices = $this->getCurrentStationPrices($station->numero);
                
                $regularPrice = $prices->where('fuel_type', 'regular')->first();
                $premiumPrice = $prices->where('fuel_type', 'premium')->first();
                $dieselPrice = $prices->where('fuel_type', 'diesel')->first();
                
                $station->regular_price = $regularPrice ? $regularPrice->price : null;
                $station->premium_price = $premiumPrice ? $premiumPrice->price : null;
                $station->diesel_price = $dieselPrice ? $dieselPrice->price : null;
            }

            return $stations;
        });
    }

    /**
     * Get municipality price averages
     */
    public function getMunicipioPriceAverages(int $municipioId): array
    {
        $cacheKey = "telegram:avg:{$municipioId}:all";
        
        return Cache::remember($cacheKey, 300, function () use ($municipioId) {
            $result = DB::table('price_changes as pc')
                ->join('stations as s', 's.numero', '=', 'pc.station_numero')
                ->select([
                    'pc.fuel_type',
                    DB::raw('AVG(pc.price) as average'),
                    DB::raw('COUNT(DISTINCT pc.station_numero) as count')
                ])
                ->where('s.municipio_id', $municipioId)
                ->where('s.is_active', true)
                ->whereRaw('pc.id = (
                    SELECT id FROM price_changes pc2 
                    WHERE pc2.station_numero = pc.station_numero 
                    AND pc2.fuel_type = pc.fuel_type 
                    ORDER BY pc2.changed_at DESC 
                    LIMIT 1
                )')
                ->groupBy('pc.fuel_type')
                ->get();

            $averages = [];
            foreach ($result as $row) {
                $averages[$row->fuel_type] = [
                    'average' => $row->average,
                    'count' => $row->count
                ];
            }

            // Get total station count
            $stationCount = DB::table('stations')
                ->where('municipio_id', $municipioId)
                ->where('is_active', true)
                ->count();

            $averages['station_count'] = $stationCount;

            return $averages;
        });
    }

    /**
     * Search stations by name with fuzzy matching
     */
    public function searchStations(string $searchTerm): Collection
    {
        $cacheKey = "telegram:search:" . md5($searchTerm);
        
        return Cache::remember($cacheKey, 300, function () use ($searchTerm) {
            // First try exact match
            $exactMatch = DB::table('stations')
                ->where('is_active', true)
                ->where('nombre', 'LIKE', "%{$searchTerm}%")
                ->limit(10)
                ->get();

            if ($exactMatch->isNotEmpty()) {
                return $exactMatch;
            }

            // Fuzzy search using similarity
            $searchWords = explode(' ', strtolower($searchTerm));
            $query = DB::table('stations')
                ->where('is_active', true);

            foreach ($searchWords as $word) {
                if (strlen($word) > 2) {
                    $query->where(function ($q) use ($word) {
                        $q->where('nombre', 'LIKE', "%{$word}%")
                          ->orWhere('direccion', 'LIKE', "%{$word}%")
                          ->orWhere('brand', 'LIKE', "%{$word}%");
                    });
                }
            }

            return $query->limit(10)->get();
        });
    }

    /**
     * Get price history for a station
     */
    public function getPriceHistory(string $stationNumero, int $days = 7): Collection
    {
        $cacheKey = "telegram:history:{$stationNumero}:{$days}";
        
        return Cache::remember($cacheKey, 300, function () use ($stationNumero, $days) {
            return DB::table('price_changes')
                ->where('station_numero', $stationNumero)
                ->where('changed_at', '>=', now()->subDays($days))
                ->orderBy('changed_at', 'desc')
                ->get();
        });
    }

    /**
     * Clear user-related caches
     */
    public function clearUserCache(int $userId): void
    {
        Cache::forget("telegram:user:{$userId}:stations");
    }
}