<?php

namespace App\Repositories;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PriceRepository
{
    private const CACHE_TTL = 300; // 5 minutes

    private const CACHE_TAG = 'prices';

    public function getCurrentPrices(array $filters = [], bool $fresh = false): LengthAwarePaginator
    {
        $cacheKey = $this->buildCacheKey('current', $filters, request('page', 1));

        if ($fresh) {
            Cache::tags([self::CACHE_TAG])->forget($cacheKey);
        }

        return Cache::tags([self::CACHE_TAG])->remember($cacheKey, self::CACHE_TTL, function () use ($filters) {
            $query = $this->buildCurrentPricesQuery($filters);

            return $query->paginate(request('page_size', 50));
        });
    }

    public function getStationPrices(string $numero): ?array
    {
        $cacheKey = "prices:station:{$numero}";

        return Cache::tags([self::CACHE_TAG])->remember($cacheKey, self::CACHE_TTL, function () use ($numero) {
            $station = DB::table('stations')
                ->where('numero', $numero)
                ->where('is_active', true)
                ->first();

            if (! $station) {
                return null;
            }

            $prices = $this->getLatestPricesForStation($numero);

            return [
                'station' => $station,
                'prices' => $prices,
                'last_updated' => $prices->max('changed_at'),
            ];
        });
    }

    public function getNearbyPrices(float $lat, float $lng, float $radius = 5, bool $fresh = false): LengthAwarePaginator
    {
        $cacheKey = "prices:nearby:{$lat}:{$lng}:{$radius}:page_".request('page', 1);

        if ($fresh) {
            Cache::tags([self::CACHE_TAG])->forget($cacheKey);
        }

        return Cache::tags([self::CACHE_TAG])->remember($cacheKey, self::CACHE_TTL, function () use ($lat, $lng, $radius) {
            $haversine = $this->buildHaversineFormula($lat, $lng);

            $query = DB::table('stations as s')
                ->selectRaw("s.*, $haversine AS distance_km")
                ->whereRaw("$haversine < ?", [$radius])
                ->where('s.is_active', true)
                ->orderBy('distance_km');

            $stations = $query->paginate(request('page_size', 50));

            // Add latest prices for each station
            $stationsWithPrices = collect($stations->items())->map(function ($station) {
                $prices = $this->getLatestPricesForStation($station->numero);

                return [
                    'station' => $station,
                    'prices' => $prices,
                    'distance_km' => $station->distance_km,
                    'last_updated' => $prices->max('changed_at'),
                ];
            });

            return new LengthAwarePaginator(
                $stationsWithPrices,
                $stations->total(),
                $stations->perPage(),
                $stations->currentPage(),
                ['path' => request()->url()]
            );
        });
    }

    private function buildCurrentPricesQuery(array $filters)
    {
        $latestPricesSubquery = $this->getLatestPricesSubquery();

        $query = DB::table('stations as s')
            ->joinSub($latestPricesSubquery, 'lp', function ($join) {
                $join->on('s.numero', '=', 'lp.station_numero');
            })
            ->leftJoin('entidades as e', 's.entidad_id', '=', 'e.id')
            ->leftJoin('municipios as m', 's.municipio_id', '=', 'm.id')
            ->select([
                's.*',
                'e.nombre as entidad_nombre',
                'm.nombre as municipio_nombre',
                'lp.fuel_type',
                'lp.price',
                'lp.changed_at',
                'lp.trend',
            ])
            ->where('s.is_active', true);

        if (isset($filters['entidad'])) {
            $query->where('s.entidad_id', $filters['entidad']);
        }

        if (isset($filters['municipio'])) {
            $query->where('s.municipio_id', $filters['municipio']);
        }

        if (isset($filters['brand'])) {
            $query->where('s.brand', $filters['brand']);
        }

        return $query->orderBy('s.nombre');
    }

    private function getLatestPricesSubquery()
    {
        return DB::table('price_changes as pc1')
            ->select([
                'pc1.station_numero',
                'pc1.fuel_type',
                'pc1.price',
                'pc1.changed_at',
                DB::raw("
                    CASE
                        WHEN prev.price < pc1.price THEN 'up'
                        WHEN prev.price > pc1.price THEN 'down'
                        ELSE 'stable'
                    END as trend
                "),
            ])
            ->leftJoinSub(
                DB::table('price_changes as pc2')
                    ->select([
                        'station_numero',
                        'fuel_type',
                        'price',
                        DB::raw('ROW_NUMBER() OVER (PARTITION BY station_numero, fuel_type ORDER BY changed_at DESC) as rn'),
                    ]),
                'prev',
                function ($join) {
                    $join->on('pc1.station_numero', '=', 'prev.station_numero')
                        ->on('pc1.fuel_type', '=', 'prev.fuel_type')
                        ->where('prev.rn', '=', 2);
                }
            )
            ->whereIn(DB::raw('(pc1.station_numero, pc1.fuel_type, pc1.changed_at)'), function ($query) {
                $query->select(['station_numero', 'fuel_type', DB::raw('MAX(changed_at)')])
                    ->from('price_changes')
                    ->groupBy(['station_numero', 'fuel_type']);
            });
    }

    private function getLatestPricesForStation(string $stationNumero): Collection
    {
        return DB::table('price_changes as pc1')
            ->select([
                'pc1.fuel_type',
                'pc1.price',
                'pc1.changed_at',
                DB::raw("
                    CASE
                        WHEN prev.price < pc1.price THEN 'up'
                        WHEN prev.price > pc1.price THEN 'down'
                        ELSE 'stable'
                    END as trend
                "),
                DB::raw('
                    CASE
                        WHEN prev.price IS NOT NULL AND prev.price > 0 
                        THEN ROUND(((pc1.price - prev.price) / prev.price) * 100, 2)
                        ELSE 0
                    END as change_percent
                '),
            ])
            ->leftJoinSub(
                DB::table('price_changes as pc2')
                    ->select([
                        'station_numero',
                        'fuel_type',
                        'price',
                        DB::raw('ROW_NUMBER() OVER (PARTITION BY station_numero, fuel_type ORDER BY changed_at DESC) as rn'),
                    ])
                    ->where('station_numero', $stationNumero),
                'prev',
                function ($join) {
                    $join->on('pc1.station_numero', '=', 'prev.station_numero')
                        ->on('pc1.fuel_type', '=', 'prev.fuel_type')
                        ->where('prev.rn', '=', 2);
                }
            )
            ->where('pc1.station_numero', $stationNumero)
            ->whereIn(DB::raw('(pc1.fuel_type, pc1.changed_at)'), function ($query) use ($stationNumero) {
                $query->select(['fuel_type', DB::raw('MAX(changed_at)')])
                    ->from('price_changes')
                    ->where('station_numero', $stationNumero)
                    ->groupBy('fuel_type');
            })
            ->get();
    }

    private function buildHaversineFormula(float $lat, float $lng): string
    {
        return "(6371 * acos(cos(radians($lat))
                  * cos(radians(lat))
                  * cos(radians(lng) - radians($lng))
                  + sin(radians($lat))
                  * sin(radians(lat))))";
    }

    private function buildCacheKey(string $type, array $filters, int $page = 1): string
    {
        $filterString = implode(':', [
            $filters['entidad'] ?? 'all',
            $filters['municipio'] ?? 'all',
            $filters['brand'] ?? 'all',
        ]);

        return "prices:{$type}:{$filterString}:page_{$page}";
    }
}
