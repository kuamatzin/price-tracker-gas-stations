<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GeographicComparisonService
{
    public function compareAreas(array $areas, array $fuelTypes = ['regular', 'premium', 'diesel'])
    {
        $results = [];

        foreach ($areas as $area) {
            $stats = $this->getAreaStatistics($area, $fuelTypes);
            if ($stats) {
                $results[$this->getAreaKey($area)] = $stats;
            }
        }

        if (empty($results)) {
            return [
                'areas' => [],
                'comparison' => [],
                'insights' => [],
                'rankings' => []
            ];
        }

        $comparison = $this->buildComparisonMatrix($results, $fuelTypes);
        $insights = $this->generateInsights($results, $fuelTypes);
        $rankings = $this->rankAreas($results, $fuelTypes);

        return [
            'areas' => $results,
            'comparison' => $comparison,
            'insights' => $insights,
            'rankings' => $rankings
        ];
    }

    private function getAreaStatistics($area, $fuelTypes)
    {
        $stats = [
            'type' => $area['type'],
            'id' => $area['id'],
            'name' => '',
            'fuel_prices' => []
        ];

        if ($area['type'] === 'estado') {
            $estado = DB::table('entidades')->where('id', $area['id'])->first();
            if (!$estado) {
                return null;
            }
            $stats['name'] = $estado->nombre;

            foreach ($fuelTypes as $fuelType) {
                $priceData = DB::table('stations as s')
                    ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                    ->where('pc.fuel_type', $fuelType)
                    ->whereRaw('pc.changed_at = (
                        SELECT MAX(pc2.changed_at) 
                        FROM price_changes pc2 
                        WHERE pc2.station_numero = pc.station_numero 
                        AND pc2.fuel_type = pc.fuel_type
                        AND pc.changed_at >= ?
                    )', [Carbon::now()->subHours(24)])
                    ->where('s.entidad_id', $area['id'])
                    ->where('s.is_active', true)
                    ->selectRaw('
                        AVG(pc.price) as avg_price,
                        MIN(pc.price) as min_price,
                        MAX(pc.price) as max_price,
                        COUNT(DISTINCT s.numero) as station_count
                    ')
                    ->first();

                if ($priceData && $priceData->avg_price) {
                    // Get prices for stddev calculation
                    $twentyFourHoursAgo = Carbon::now()->subHours(24);
                    $prices = DB::table('stations as s')
                        ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                        ->where('pc.fuel_type', $fuelType)
                        ->whereRaw('pc.changed_at = (
                            SELECT MAX(pc2.changed_at) 
                            FROM price_changes pc2 
                            WHERE pc2.station_numero = pc.station_numero 
                            AND pc2.fuel_type = pc.fuel_type
                            AND pc.changed_at >= ?
                        )', [$twentyFourHoursAgo])
                        ->where('s.' . ($area['type'] === 'estado' ? 'entidad_id' : 'municipio_id'), $area['id'])
                        ->where('s.is_active', true)
                        ->pluck('pc.price')
                        ->toArray();
                    
                    $stddev = $this->calculateStdDev($prices);
                    
                    $stats['fuel_prices'][$fuelType] = [
                        'avg' => round($priceData->avg_price, 2),
                        'min' => $priceData->min_price,
                        'max' => $priceData->max_price,
                        'stddev' => $stddev,
                        'station_count' => $priceData->station_count
                    ];
                }
            }
        } elseif ($area['type'] === 'municipio') {
            $municipio = DB::table('municipios')->where('id', $area['id'])->first();
            if (!$municipio) {
                return null;
            }
            $stats['name'] = $municipio->nombre;

            foreach ($fuelTypes as $fuelType) {
                $priceData = DB::table('stations as s')
                    ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                    ->where('pc.fuel_type', $fuelType)
                    ->whereRaw('pc.changed_at = (
                        SELECT MAX(pc2.changed_at) 
                        FROM price_changes pc2 
                        WHERE pc2.station_numero = pc.station_numero 
                        AND pc2.fuel_type = pc.fuel_type
                        AND pc.changed_at >= ?
                    )', [Carbon::now()->subHours(24)])
                    ->where('s.municipio_id', $area['id'])
                    ->where('s.is_active', true)
                    ->selectRaw('
                        AVG(pc.price) as avg_price,
                        MIN(pc.price) as min_price,
                        MAX(pc.price) as max_price,
                        COUNT(DISTINCT s.numero) as station_count
                    ')
                    ->first();

                if ($priceData && $priceData->avg_price) {
                    // Get prices for stddev calculation
                    $twentyFourHoursAgo = Carbon::now()->subHours(24);
                    $prices = DB::table('stations as s')
                        ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
                        ->where('pc.fuel_type', $fuelType)
                        ->whereRaw('pc.changed_at = (
                            SELECT MAX(pc2.changed_at) 
                            FROM price_changes pc2 
                            WHERE pc2.station_numero = pc.station_numero 
                            AND pc2.fuel_type = pc.fuel_type
                            AND pc.changed_at >= ?
                        )', [$twentyFourHoursAgo])
                        ->where('s.' . ($area['type'] === 'estado' ? 'entidad_id' : 'municipio_id'), $area['id'])
                        ->where('s.is_active', true)
                        ->pluck('pc.price')
                        ->toArray();
                    
                    $stddev = $this->calculateStdDev($prices);
                    
                    $stats['fuel_prices'][$fuelType] = [
                        'avg' => round($priceData->avg_price, 2),
                        'min' => $priceData->min_price,
                        'max' => $priceData->max_price,
                        'stddev' => $stddev,
                        'station_count' => $priceData->station_count
                    ];
                }
            }
        }

        // Add population weighting if available
        $stats['population'] = $this->getAreaPopulation($area);
        
        return $stats;
    }

    private function buildComparisonMatrix($results, $fuelTypes)
    {
        $matrix = [];
        $areaIds = array_keys($results);

        foreach ($areaIds as $fromId) {
            foreach ($areaIds as $toId) {
                if ($fromId === $toId) {
                    continue;
                }

                foreach ($fuelTypes as $fuel) {
                    if (isset($results[$fromId]['fuel_prices'][$fuel]) && 
                        isset($results[$toId]['fuel_prices'][$fuel])) {
                        
                        $fromPrice = $results[$fromId]['fuel_prices'][$fuel]['avg'];
                        $toPrice = $results[$toId]['fuel_prices'][$fuel]['avg'];

                        $matrix[$fromId][$toId][$fuel] = [
                            'difference' => round($fromPrice - $toPrice, 2),
                            'percent' => round((($fromPrice - $toPrice) / $toPrice) * 100, 2),
                            'cheaper' => $fromPrice < $toPrice
                        ];
                    }
                }
            }
        }

        return $matrix;
    }

    private function generateInsights($results, $fuelTypes)
    {
        $insights = [];

        foreach ($fuelTypes as $fuel) {
            $prices = [];
            foreach ($results as $areaKey => $data) {
                if (isset($data['fuel_prices'][$fuel])) {
                    $prices[$areaKey] = $data['fuel_prices'][$fuel]['avg'];
                }
            }

            if (empty($prices)) {
                continue;
            }

            $minPrice = min($prices);
            $maxPrice = max($prices);
            $minArea = array_search($minPrice, $prices);
            $maxArea = array_search($maxPrice, $prices);

            $insights[] = [
                'type' => 'price_leader',
                'fuel' => $fuel,
                'area' => $minArea,
                'area_name' => $results[$minArea]['name'],
                'message' => "Cheapest $fuel prices",
                'value' => $minPrice
            ];

            $insights[] = [
                'type' => 'price_laggard',
                'fuel' => $fuel,
                'area' => $maxArea,
                'area_name' => $results[$maxArea]['name'],
                'message' => "Most expensive $fuel prices",
                'value' => $maxPrice
            ];

            // Price spread insight
            if (count($prices) > 2) {
                $avgPrice = array_sum($prices) / count($prices);
                $insights[] = [
                    'type' => 'average_price',
                    'fuel' => $fuel,
                    'message' => "Average $fuel price across compared areas",
                    'value' => round($avgPrice, 2)
                ];
            }
        }

        // Calculate price disparity within areas
        $disparities = [];
        foreach ($results as $areaKey => $stats) {
            if (isset($stats['fuel_prices']['regular'])) {
                $spread = $stats['fuel_prices']['regular']['max'] - $stats['fuel_prices']['regular']['min'];
                $disparities[$areaKey] = $spread;
            }
        }

        if (!empty($disparities)) {
            $maxDisparity = max($disparities);
            $maxDisparityArea = array_search($maxDisparity, $disparities);

            $insights[] = [
                'type' => 'price_disparity',
                'area' => $maxDisparityArea,
                'area_name' => $results[$maxDisparityArea]['name'],
                'message' => 'Highest price variation within area',
                'value' => round($maxDisparity, 2)
            ];

            $minDisparity = min($disparities);
            $minDisparityArea = array_search($minDisparity, $disparities);

            $insights[] = [
                'type' => 'price_uniformity',
                'area' => $minDisparityArea,
                'area_name' => $results[$minDisparityArea]['name'],
                'message' => 'Most uniform prices within area',
                'value' => round($minDisparity, 2)
            ];
        }

        // Market competition insight
        foreach ($results as $areaKey => $stats) {
            $competitionScore = 0;
            $fuelCount = 0;
            
            foreach ($fuelTypes as $fuel) {
                if (isset($stats['fuel_prices'][$fuel])) {
                    $cv = $stats['fuel_prices'][$fuel]['stddev'] / $stats['fuel_prices'][$fuel]['avg'];
                    $competitionScore += $cv;
                    $fuelCount++;
                }
            }
            
            if ($fuelCount > 0) {
                $results[$areaKey]['competition_score'] = round($competitionScore / $fuelCount * 100, 2);
            }
        }

        // Find most and least competitive markets
        $competitionScores = array_column($results, 'competition_score');
        if (!empty($competitionScores)) {
            $maxCompetition = max($competitionScores);
            $minCompetition = min($competitionScores);
            
            foreach ($results as $areaKey => $stats) {
                if (isset($stats['competition_score'])) {
                    if ($stats['competition_score'] == $maxCompetition) {
                        $insights[] = [
                            'type' => 'high_competition',
                            'area' => $areaKey,
                            'area_name' => $stats['name'],
                            'message' => 'Most competitive market (highest price variation)',
                            'value' => $maxCompetition
                        ];
                    }
                    if ($stats['competition_score'] == $minCompetition) {
                        $insights[] = [
                            'type' => 'low_competition',
                            'area' => $areaKey,
                            'area_name' => $stats['name'],
                            'message' => 'Least competitive market (lowest price variation)',
                            'value' => $minCompetition
                        ];
                    }
                }
            }
        }

        return $insights;
    }

    private function rankAreas($results, $fuelTypes)
    {
        $rankings = [];

        // Calculate overall score for each area
        foreach ($results as $areaKey => $data) {
            $score = 0;
            $weightSum = 0;

            foreach ($fuelTypes as $fuel) {
                if (isset($data['fuel_prices'][$fuel])) {
                    // Lower average price is better
                    $avgPrice = $data['fuel_prices'][$fuel]['avg'];
                    $stationCount = $data['fuel_prices'][$fuel]['station_count'];
                    
                    // Weight by station count (more stations = more reliable data)
                    $weight = sqrt($stationCount);
                    $score += (100 / $avgPrice) * $weight;
                    $weightSum += $weight;
                }
            }

            if ($weightSum > 0) {
                $finalScore = round($score / $weightSum, 2);
                
                $rankings[] = [
                    'area_key' => $areaKey,
                    'area_type' => $data['type'],
                    'area_id' => $data['id'],
                    'name' => $data['name'],
                    'score' => $finalScore,
                    'avg_prices' => [
                        'regular' => $data['fuel_prices']['regular']['avg'] ?? null,
                        'premium' => $data['fuel_prices']['premium']['avg'] ?? null,
                        'diesel' => $data['fuel_prices']['diesel']['avg'] ?? null
                    ],
                    'total_stations' => array_sum(array_column($data['fuel_prices'], 'station_count'))
                ];
            }
        }

        // Sort by score (higher is better - means lower prices)
        usort($rankings, function ($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        // Add position
        foreach ($rankings as $index => &$ranking) {
            $ranking['position'] = $index + 1;
        }

        return $rankings;
    }

    private function getAreaKey($area)
    {
        return $area['type'] . '_' . $area['id'];
    }

    private function getAreaPopulation($area)
    {
        // This would typically query a population table
        // For now, return null as population data might not be available
        return null;
    }

    private function calculateStdDev($values)
    {
        $count = count($values);
        if ($count <= 1) {
            return 0;
        }

        $mean = array_sum($values) / $count;
        $sum = 0;

        foreach ($values as $value) {
            $sum += pow($value - $mean, 2);
        }

        return round(sqrt($sum / ($count - 1)), 2);
    }
}