<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class HeatMapDataService
{
    public function generateHeatMap($bounds, $zoomLevel, $fuelType = 'regular')
    {
        $gridSize = $this->calculateGridSize($zoomLevel);
        $stations = $this->getStationsInBounds($bounds, $fuelType);
        
        if ($stations->isEmpty()) {
            return [
                'bounds' => $bounds,
                'zoom' => $zoomLevel,
                'grid_size' => $gridSize,
                'cells' => [],
                'legend' => $this->generateLegend([], $fuelType),
                'timestamp' => now()->toIso8601String()
            ];
        }

        $grid = $this->createGrid($bounds, $gridSize);
        $priceRange = $this->getPriceRange($stations);

        foreach ($grid as &$cell) {
            $interpolatedPrice = $this->interpolatePrice(
                $cell['center'],
                $stations
            );
            
            $cell['price'] = $interpolatedPrice;
            $cell['intensity'] = $this->calculateIntensity(
                $interpolatedPrice,
                $priceRange['min'],
                $priceRange['max']
            );
            $cell['color'] = $this->getColorGradient($cell['intensity']);
            
            // Find nearby stations for the cell
            $cell['nearby_stations'] = $this->findNearbyStations(
                $cell['center'],
                $stations,
                $gridSize * 111 // Convert degrees to km (rough approximation)
            );
        }

        return [
            'bounds' => $bounds,
            'zoom' => $zoomLevel,
            'grid_size' => $gridSize,
            'fuel_type' => $fuelType,
            'cells' => $grid,
            'legend' => $this->generateLegend($priceRange, $fuelType),
            'statistics' => [
                'total_stations' => count($stations),
                'min_price' => $priceRange['min'],
                'max_price' => $priceRange['max'],
                'avg_price' => round($stations->avg('price'), 2)
            ],
            'timestamp' => now()->toIso8601String()
        ];
    }

    private function calculateGridSize($zoomLevel)
    {
        // Grid size in degrees, smaller for higher zoom levels
        $baseSizes = [
            1 => 10,      // Country level
            2 => 5,
            3 => 2.5,
            4 => 1.25,
            5 => 0.625,
            6 => 0.3125,
            7 => 0.15625,
            8 => 0.078125,
            9 => 0.0390625,
            10 => 0.01953125,
            11 => 0.009765625,
            12 => 0.0048828125,  // City level
            13 => 0.00244140625,
            14 => 0.001220703125,
            15 => 0.0006103515625,
            16 => 0.00030517578125,
            17 => 0.000152587890625,
            18 => 0.0000762939453125,
            19 => 0.00003814697265625,
            20 => 0.000019073486328125  // Street level
        ];

        return $baseSizes[$zoomLevel] ?? 0.01;
    }

    private function getStationsInBounds($bounds, $fuelType)
    {
        $twentyFourHoursAgo = Carbon::now()->subHours(24);
        return DB::table('stations as s')
            ->join('price_changes as pc', 'pc.station_numero', '=', 's.numero')
            ->where('pc.fuel_type', $fuelType)
            ->whereRaw('pc.changed_at = (
                SELECT MAX(pc2.changed_at) 
                FROM price_changes pc2 
                WHERE pc2.station_numero = pc.station_numero 
                AND pc2.fuel_type = pc.fuel_type
                AND pc.changed_at >= ?
            )', [$twentyFourHoursAgo])
            ->where('s.is_active', true)
            ->whereBetween('s.lat', [$bounds['south'], $bounds['north']])
            ->whereBetween('s.lng', [$bounds['west'], $bounds['east']])
            ->select('s.numero', 's.nombre', 's.lat', 's.lng', 's.brand', 'pc.price')
            ->get();
    }

    private function createGrid($bounds, $gridSize)
    {
        $grid = [];
        $latSteps = ceil(($bounds['north'] - $bounds['south']) / $gridSize);
        $lngSteps = ceil(($bounds['east'] - $bounds['west']) / $gridSize);

        for ($latIndex = 0; $latIndex < $latSteps; $latIndex++) {
            for ($lngIndex = 0; $lngIndex < $lngSteps; $lngIndex++) {
                $cellLat = $bounds['south'] + ($latIndex * $gridSize) + ($gridSize / 2);
                $cellLng = $bounds['west'] + ($lngIndex * $gridSize) + ($gridSize / 2);

                // Only create cell if it's within bounds
                if ($cellLat <= $bounds['north'] && $cellLng <= $bounds['east']) {
                    $grid[] = [
                        'id' => "cell_{$latIndex}_{$lngIndex}",
                        'bounds' => [
                            'north' => min($bounds['south'] + (($latIndex + 1) * $gridSize), $bounds['north']),
                            'south' => $bounds['south'] + ($latIndex * $gridSize),
                            'east' => min($bounds['west'] + (($lngIndex + 1) * $gridSize), $bounds['east']),
                            'west' => $bounds['west'] + ($lngIndex * $gridSize)
                        ],
                        'center' => [
                            'lat' => $cellLat,
                            'lng' => $cellLng
                        ]
                    ];
                }
            }
        }

        return $grid;
    }

    private function interpolatePrice($point, $stations)
    {
        if ($stations->isEmpty()) {
            return 0;
        }

        $weights = [];
        $weightedPrice = 0;
        $maxDistance = 50; // Maximum distance in km for interpolation

        foreach ($stations as $station) {
            $distance = $this->haversineDistance(
                $point['lat'],
                $point['lng'],
                $station->lat,
                $station->lng
            );

            if ($distance > $maxDistance) {
                continue;
            }

            // Inverse distance weighting with power parameter
            $weight = 1 / pow(max($distance, 0.1), 2);
            $weights[] = $weight;
            $weightedPrice += $station->price * $weight;
        }

        if (empty($weights)) {
            // If no stations within max distance, use average of all stations
            return round($stations->avg('price'), 2);
        }

        $totalWeight = array_sum($weights);
        return $totalWeight > 0 ? round($weightedPrice / $totalWeight, 2) : 0;
    }

    private function haversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371; // Earth radius in kilometers

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        
        return $earthRadius * $c;
    }

    private function calculateIntensity($price, $minPrice, $maxPrice)
    {
        if ($maxPrice == $minPrice) {
            return 50;
        }

        // Normalize price to 0-100 scale
        $normalized = (($price - $minPrice) / ($maxPrice - $minPrice)) * 100;
        return round($normalized, 2);
    }

    private function getColorGradient($intensity)
    {
        // Green (cheap) -> Yellow (average) -> Red (expensive)
        $colors = [
            0 => ['r' => 0, 'g' => 255, 'b' => 0],      // Green
            50 => ['r' => 255, 'g' => 255, 'b' => 0],   // Yellow
            100 => ['r' => 255, 'g' => 0, 'b' => 0]     // Red
        ];

        if ($intensity <= 50) {
            $ratio = $intensity / 50;
            $color = $this->interpolateColor($colors[0], $colors[50], $ratio);
        } else {
            $ratio = ($intensity - 50) / 50;
            $color = $this->interpolateColor($colors[50], $colors[100], $ratio);
        }

        // Convert to hex color
        return sprintf(
            "#%02X%02X%02X",
            round($color['r']),
            round($color['g']),
            round($color['b'])
        );
    }

    private function interpolateColor($color1, $color2, $ratio)
    {
        return [
            'r' => $color1['r'] + ($color2['r'] - $color1['r']) * $ratio,
            'g' => $color1['g'] + ($color2['g'] - $color1['g']) * $ratio,
            'b' => $color1['b'] + ($color2['b'] - $color1['b']) * $ratio
        ];
    }

    private function generateLegend($priceRange, $fuelType)
    {
        if (empty($priceRange)) {
            return [
                'fuel_type' => $fuelType,
                'min_price' => 0,
                'max_price' => 0,
                'color_scale' => []
            ];
        }

        $minPrice = $priceRange['min'];
        $maxPrice = $priceRange['max'];
        $steps = 5;
        $colorScale = [];

        for ($i = 0; $i <= $steps; $i++) {
            $ratio = $i / $steps;
            $price = $minPrice + ($maxPrice - $minPrice) * $ratio;
            $intensity = $ratio * 100;
            
            $colorScale[] = [
                'value' => round($price, 2),
                'color' => $this->getColorGradient($intensity),
                'label' => $this->getPriceLabel($price, $minPrice, $maxPrice)
            ];
        }

        return [
            'fuel_type' => $fuelType,
            'min_price' => $minPrice,
            'max_price' => $maxPrice,
            'color_scale' => $colorScale
        ];
    }

    private function getPriceLabel($price, $minPrice, $maxPrice)
    {
        $range = $maxPrice - $minPrice;
        $position = ($price - $minPrice) / $range;

        if ($position <= 0.2) return 'Very Low';
        if ($position <= 0.4) return 'Low';
        if ($position <= 0.6) return 'Average';
        if ($position <= 0.8) return 'High';
        return 'Very High';
    }

    private function getPriceRange($stations)
    {
        if ($stations->isEmpty()) {
            return ['min' => 0, 'max' => 0];
        }

        return [
            'min' => $stations->min('price'),
            'max' => $stations->max('price')
        ];
    }

    private function findNearbyStations($point, $stations, $radius)
    {
        $nearby = [];

        foreach ($stations as $station) {
            $distance = $this->haversineDistance(
                $point['lat'],
                $point['lng'],
                $station->lat,
                $station->lng
            );

            if ($distance <= $radius) {
                $nearby[] = [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                    'brand' => $station->brand,
                    'price' => $station->price,
                    'distance' => round($distance, 2)
                ];
            }
        }

        // Sort by distance
        usort($nearby, function ($a, $b) {
            return $a['distance'] <=> $b['distance'];
        });

        // Return only closest 3 stations
        return array_slice($nearby, 0, 3);
    }
}