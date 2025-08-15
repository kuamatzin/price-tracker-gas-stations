<?php

namespace App\Services;

use App\Models\Station;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CompetitorService
{
    public function getUserStation($stationNumero)
    {
        return Station::where('numero', $stationNumero)
            ->where('is_active', true)
            ->first();
    }
    
    public function getCompetitors(Station $station, string $mode = 'radius', float $radius = 5): Collection
    {
        switch ($mode) {
            case 'radius':
                return $this->getCompetitorsByRadius($station, $radius);
            case 'municipio':
                return $this->getCompetitorsByMunicipio($station);
            case 'combined':
                $radiusCompetitors = $this->getCompetitorsByRadius($station, $radius);
                $municipioCompetitors = $this->getCompetitorsByMunicipio($station);
                return $radiusCompetitors->merge($municipioCompetitors)->unique('numero');
            default:
                return $this->getCompetitorsByRadius($station, $radius);
        }
    }
    
    public function getCompetitorsByRadius(Station $station, float $radius = 5): Collection
    {
        $haversine = "(6371 * acos(cos(radians({$station->lat}))
                      * cos(radians(lat))
                      * cos(radians(lng) - radians({$station->lng}))
                      + sin(radians({$station->lat}))
                      * sin(radians(lat))))";
        
        $competitors = Station::selectRaw("*, {$haversine} AS distance_km")
            ->where('numero', '!=', $station->numero)
            ->whereRaw("{$haversine} < ?", [$radius])
            ->where('is_active', true)
            ->orderBy('distance_km')
            ->get();
        
        return $this->enrichCompetitorsWithPrices($competitors);
    }
    
    public function getCompetitorsByMunicipio(Station $station): Collection
    {
        $competitors = Station::where('municipio_id', $station->municipio_id)
            ->where('numero', '!=', $station->numero)
            ->where('is_active', true)
            ->get();
        
        return $this->enrichCompetitorsWithPrices($competitors);
    }
    
    protected function enrichCompetitorsWithPrices(Collection $stations): Collection
    {
        $stationNumeros = $stations->pluck('numero')->toArray();
        
        if (empty($stationNumeros)) {
            return collect();
        }
        
        $prices = DB::table('price_changes as pc')
            ->select('pc.station_numero', 'pc.fuel_type', 'pc.price', 'pc.changed_at')
            ->whereIn('pc.station_numero', $stationNumeros)
            ->whereIn('pc.id', function ($query) {
                $query->selectRaw('MAX(id)')
                    ->from('price_changes')
                    ->whereColumn('station_numero', 'pc.station_numero')
                    ->whereColumn('fuel_type', 'pc.fuel_type')
                    ->groupBy('station_numero', 'fuel_type');
            })
            ->get();
        
        $priceMap = [];
        foreach ($prices as $price) {
            if (!isset($priceMap[$price->station_numero])) {
                $priceMap[$price->station_numero] = [];
            }
            $priceMap[$price->station_numero][$price->fuel_type] = $price->price;
        }
        
        return $stations->map(function ($station) use ($priceMap) {
            $stationPrices = $priceMap[$station->numero] ?? [];
            
            return [
                'numero' => $station->numero,
                'nombre' => $station->nombre,
                'brand' => $station->brand,
                'distance_km' => round($station->distance_km ?? 0, 2),
                'prices' => [
                    'regular' => $stationPrices['regular'] ?? null,
                    'premium' => $stationPrices['premium'] ?? null,
                    'diesel' => $stationPrices['diesel'] ?? null,
                ],
                'last_update' => $station->last_price_update
            ];
        });
    }
    
    public function getCompetitiveInsights(Station $userStation, Collection $competitors): array
    {
        $insights = [
            'pricing_patterns' => $this->identifyPricingPatterns($competitors),
            'price_leadership' => $this->detectPriceLeadership($competitors),
            'optimal_windows' => $this->findOptimalPricingWindows($userStation, $competitors),
            'market_share_estimate' => $this->estimateMarketShare($userStation, $competitors),
            'competitive_alerts' => $this->generateCompetitiveAlerts($userStation, $competitors)
        ];
        
        return $insights;
    }
    
    protected function identifyPricingPatterns(Collection $competitors): array
    {
        $patterns = [];
        $brandGroups = $competitors->groupBy('brand');
        
        foreach ($brandGroups as $brand => $stations) {
            $avgPrices = [
                'regular' => $stations->avg(function ($station) {
                    return $station['prices']['regular'] ?? null;
                }),
                'premium' => $stations->avg(function ($station) {
                    return $station['prices']['premium'] ?? null;
                }),
                'diesel' => $stations->avg(function ($station) {
                    return $station['prices']['diesel'] ?? null;
                }),
            ];
            
            $patterns[$brand] = [
                'avg_prices' => array_map(function($price) {
                    return $price ? round($price, 2) : null;
                }, $avgPrices),
                'station_count' => $stations->count(),
                'pricing_strategy' => $this->determinePricingStrategy($avgPrices)
            ];
        }
        
        return $patterns;
    }
    
    protected function detectPriceLeadership(Collection $competitors): array
    {
        $leaders = [];
        
        foreach (['regular', 'premium', 'diesel'] as $fuelType) {
            $prices = $competitors->pluck("prices.{$fuelType}")->filter()->sort();
            
            if ($prices->isEmpty()) {
                continue;
            }
            
            $minPrice = $prices->first();
            $maxPrice = $prices->last();
            
            $leader = $competitors->first(function ($station) use ($fuelType, $minPrice) {
                return $station['prices'][$fuelType] === $minPrice;
            });
            
            $follower = $competitors->first(function ($station) use ($fuelType, $maxPrice) {
                return $station['prices'][$fuelType] === $maxPrice;
            });
            
            $leaders[$fuelType] = [
                'price_leader' => $leader ? [
                    'numero' => $leader['numero'],
                    'nombre' => $leader['nombre'],
                    'price' => $minPrice
                ] : null,
                'price_follower' => $follower ? [
                    'numero' => $follower['numero'],
                    'nombre' => $follower['nombre'],
                    'price' => $maxPrice
                ] : null,
                'spread' => round($maxPrice - $minPrice, 2)
            ];
        }
        
        return $leaders;
    }
    
    protected function findOptimalPricingWindows(Station $userStation, Collection $competitors): array
    {
        $windows = [];
        
        $historicalData = DB::table('price_changes')
            ->whereIn('station_numero', $competitors->pluck('numero'))
            ->where('changed_at', '>=', now()->subDays(7))
            ->select(DB::raw('EXTRACT(HOUR FROM changed_at) as hour'), DB::raw('COUNT(*) as changes'))
            ->groupBy('hour')
            ->orderBy('changes', 'desc')
            ->get();
        
        $windows['high_activity_hours'] = $historicalData->take(3)->pluck('hour')->toArray();
        $windows['low_activity_hours'] = $historicalData->reverse()->take(3)->pluck('hour')->toArray();
        
        return $windows;
    }
    
    protected function estimateMarketShare(Station $userStation, Collection $competitors): array
    {
        $totalStations = $competitors->count() + 1;
        $baseShare = 100 / $totalStations;
        
        $userPrices = DB::table('price_changes')
            ->where('station_numero', $userStation->numero)
            ->whereIn('fuel_type', ['regular', 'premium', 'diesel'])
            ->whereIn('id', function ($query) use ($userStation) {
                $query->selectRaw('MAX(id)')
                    ->from('price_changes')
                    ->where('station_numero', $userStation->numero)
                    ->groupBy('fuel_type');
            })
            ->pluck('price', 'fuel_type');
        
        $competitivenessScore = 0;
        $fuelCount = 0;
        
        foreach (['regular', 'premium', 'diesel'] as $fuelType) {
            if (!isset($userPrices[$fuelType])) {
                continue;
            }
            
            $competitorPrices = $competitors->pluck("prices.{$fuelType}")->filter();
            if ($competitorPrices->isEmpty()) {
                continue;
            }
            
            $betterThan = $competitorPrices->filter(function ($price) use ($userPrices, $fuelType) {
                return $price > $userPrices[$fuelType];
            })->count();
            
            $competitivenessScore += ($betterThan / $competitorPrices->count());
            $fuelCount++;
        }
        
        $avgCompetitiveness = $fuelCount > 0 ? $competitivenessScore / $fuelCount : 0.5;
        $estimatedShare = $baseShare * (1 + $avgCompetitiveness);
        
        return [
            'estimated_share' => round(min(100, $estimatedShare), 1),
            'competitiveness_index' => round($avgCompetitiveness * 100, 1),
            'base_share' => round($baseShare, 1)
        ];
    }
    
    protected function generateCompetitiveAlerts(Station $userStation, Collection $competitors): array
    {
        $alerts = [];
        
        $recentChanges = DB::table('price_changes')
            ->whereIn('station_numero', $competitors->pluck('numero'))
            ->where('changed_at', '>=', now()->subHours(24))
            ->select('station_numero', 'fuel_type', DB::raw('COUNT(*) as change_count'))
            ->groupBy('station_numero', 'fuel_type')
            ->having('change_count', '>', 1)
            ->get();
        
        if ($recentChanges->count() > 0) {
            $alerts[] = [
                'type' => 'high_volatility',
                'message' => "High price volatility detected in {$recentChanges->count()} competitor stations",
                'severity' => 'warning'
            ];
        }
        
        $aggressivePricing = $competitors->filter(function ($competitor) {
            $avgPrice = collect($competitor['prices'])->filter()->avg();
            return $avgPrice && $avgPrice < collect($competitor['prices'])->filter()->min() * 1.02;
        });
        
        if ($aggressivePricing->count() > 0) {
            $alerts[] = [
                'type' => 'aggressive_pricing',
                'message' => "Aggressive pricing detected from {$aggressivePricing->count()} competitors",
                'severity' => 'high'
            ];
        }
        
        return $alerts;
    }
    
    protected function determinePricingStrategy(array $avgPrices): string
    {
        $validPrices = array_filter($avgPrices);
        
        if (empty($validPrices)) {
            return 'unknown';
        }
        
        $avg = array_sum($validPrices) / count($validPrices);
        $variance = 0;
        
        foreach ($validPrices as $price) {
            $variance += pow($price - $avg, 2);
        }
        
        $stdDev = sqrt($variance / count($validPrices));
        $coefficientOfVariation = ($avg > 0) ? ($stdDev / $avg) : 0;
        
        if ($coefficientOfVariation < 0.01) {
            return 'uniform';
        } elseif ($coefficientOfVariation < 0.05) {
            return 'competitive';
        } else {
            return 'differentiated';
        }
    }
}