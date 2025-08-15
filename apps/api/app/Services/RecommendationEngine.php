<?php

namespace App\Services;

use Illuminate\Support\Collection;

class RecommendationEngine
{
    protected array $templates = [
        'above_average' => [
            'es' => 'Tu {fuel_type} está {percent}% arriba del promedio del mercado. Considera reducir ${amount} para mejorar competitividad.',
            'en' => 'Your {fuel_type} is {percent}% above market average. Consider reducing by ${amount} to improve competitiveness.',
            'priority' => 'high',
            'impact' => 'revenue'
        ],
        'below_average' => [
            'es' => 'Tu {fuel_type} está {percent}% debajo del promedio. Tienes margen para incrementar ${amount} sin perder competitividad.',
            'en' => 'Your {fuel_type} is {percent}% below average. You have room to increase by ${amount} without losing competitiveness.',
            'priority' => 'medium',
            'impact' => 'margin'
        ],
        'optimal_position' => [
            'es' => 'Tu {fuel_type} está en posición óptima (percentil {percentile}). Mantén el precio actual.',
            'en' => 'Your {fuel_type} is optimally positioned (percentile {percentile}). Maintain current pricing.',
            'priority' => 'low',
            'impact' => 'stable'
        ],
        'outlier_high' => [
            'es' => '⚠️ Tu {fuel_type} es significativamente más caro que la competencia. Revisa urgentemente.',
            'en' => '⚠️ Your {fuel_type} is significantly more expensive than competitors. Urgent review needed.',
            'priority' => 'critical',
            'impact' => 'customer_loss'
        ],
        'outlier_low' => [
            'es' => '⚠️ Tu {fuel_type} está muy por debajo del mercado. Podrías estar perdiendo margen.',
            'en' => '⚠️ Your {fuel_type} is significantly below market. You might be losing margin.',
            'priority' => 'high',
            'impact' => 'margin_loss'
        ],
        'competitive_advantage' => [
            'es' => 'Tu {fuel_type} tiene ventaja competitiva en el cuartil {quartile}. Mantén esta posición estratégica.',
            'en' => 'Your {fuel_type} has competitive advantage in quartile {quartile}. Maintain this strategic position.',
            'priority' => 'low',
            'impact' => 'positive'
        ],
    ];
    
    protected array $priorityOrder = [
        'critical' => 0,
        'high' => 1,
        'medium' => 2,
        'low' => 3
    ];
    
    public function generateRecommendations(array $analysis, string $lang = 'es'): array
    {
        $recommendations = [];
        
        foreach (['regular', 'premium', 'diesel'] as $fuelType) {
            if (!isset($analysis[$fuelType]) || empty($analysis[$fuelType]['position'])) {
                continue;
            }
            
            $fuelAnalysis = $analysis[$fuelType];
            $fuelRecommendations = $this->analyzeFuelType($fuelType, $fuelAnalysis, $lang);
            
            foreach ($fuelRecommendations as $recommendation) {
                $recommendations[] = $recommendation;
            }
        }
        
        usort($recommendations, function($a, $b) {
            return $this->priorityOrder[$a['priority']] - $this->priorityOrder[$b['priority']];
        });
        
        return array_slice($recommendations, 0, 5);
    }
    
    protected function analyzeFuelType(string $fuelType, array $analysis, string $lang): array
    {
        $recommendations = [];
        $position = $analysis['position'];
        
        if ($position['user_price'] === null) {
            return [];
        }
        
        if ($position['is_outlier']) {
            if ($position['from_avg_percent'] > 0) {
                $recommendations[] = $this->createRecommendation(
                    'outlier_high',
                    $lang,
                    [
                        'fuel_type' => $this->translateFuelType($fuelType, $lang),
                    ],
                    $position['user_price'] - abs($position['from_avg'])
                );
            } else {
                $recommendations[] = $this->createRecommendation(
                    'outlier_low',
                    $lang,
                    [
                        'fuel_type' => $this->translateFuelType($fuelType, $lang),
                    ],
                    $position['user_price'] + abs($position['from_avg']) * 0.5
                );
            }
        } elseif ($position['from_avg_percent'] > 3) {
            $recommendations[] = $this->createRecommendation(
                'above_average',
                $lang,
                [
                    'fuel_type' => $this->translateFuelType($fuelType, $lang),
                    'percent' => abs($position['from_avg_percent']),
                    'amount' => round(abs($position['from_avg']), 2)
                ],
                $position['user_price'] - abs($position['from_avg'])
            );
        } elseif ($position['from_avg_percent'] < -3) {
            $recommendations[] = $this->createRecommendation(
                'below_average',
                $lang,
                [
                    'fuel_type' => $this->translateFuelType($fuelType, $lang),
                    'percent' => abs($position['from_avg_percent']),
                    'amount' => round(abs($position['from_avg']) * 0.5, 2)
                ],
                $position['user_price'] + abs($position['from_avg']) * 0.5
            );
        } elseif ($position['quartile'] === 'Q1' || $position['quartile'] === 'Q2') {
            $recommendations[] = $this->createRecommendation(
                'competitive_advantage',
                $lang,
                [
                    'fuel_type' => $this->translateFuelType($fuelType, $lang),
                    'quartile' => $position['quartile']
                ],
                $position['user_price']
            );
        }
        
        return $recommendations;
    }
    
    protected function createRecommendation(string $templateKey, string $lang, array $values, float $suggestedPrice): array
    {
        $template = $this->templates[$templateKey];
        $message = $template[$lang] ?? $template['es'];
        
        foreach ($values as $key => $value) {
            $message = str_replace('{' . $key . '}', $value, $message);
        }
        
        return [
            'message' => $message,
            'priority' => $template['priority'],
            'fuel_type' => $values['fuel_type'] ?? null,
            'suggested_price' => round($suggestedPrice, 2),
            'potential_impact' => $this->calculateImpact($template['impact'], $values),
            'confidence' => $this->calculateConfidence($templateKey, $values)
        ];
    }
    
    protected function calculateImpact(string $impactType, array $values): string
    {
        switch ($impactType) {
            case 'revenue':
                return 'Increase customer traffic by estimated 10-15%';
            case 'margin':
                $amount = $values['amount'] ?? 0;
                return "Improve margin by approximately $" . number_format($amount * 100, 0) . " per day";
            case 'customer_loss':
                return 'Risk of losing 20-30% of price-sensitive customers';
            case 'margin_loss':
                return 'Potential margin improvement of 5-10%';
            case 'positive':
                return 'Maintain strong market position';
            default:
                return 'Stable market position';
        }
    }
    
    protected function calculateConfidence(string $templateKey, array $values): float
    {
        $baseConfidence = [
            'outlier_high' => 0.95,
            'outlier_low' => 0.90,
            'above_average' => 0.85,
            'below_average' => 0.80,
            'optimal_position' => 0.75,
            'competitive_advantage' => 0.70,
        ];
        
        $confidence = $baseConfidence[$templateKey] ?? 0.50;
        
        if (isset($values['percent'])) {
            $percentDiff = abs($values['percent']);
            if ($percentDiff > 10) {
                $confidence = min(1.0, $confidence + 0.1);
            }
        }
        
        return round($confidence, 2);
    }
    
    protected function translateFuelType(string $fuelType, string $lang): string
    {
        $translations = [
            'es' => [
                'regular' => 'Regular',
                'premium' => 'Premium',
                'diesel' => 'Diésel'
            ],
            'en' => [
                'regular' => 'Regular',
                'premium' => 'Premium',
                'diesel' => 'Diesel'
            ]
        ];
        
        return $translations[$lang][$fuelType] ?? $fuelType;
    }
}