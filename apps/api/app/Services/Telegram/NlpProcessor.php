<?php

namespace App\Services\Telegram;

use App\Services\External\DeepSeekService;
use Illuminate\Support\Facades\Log;

class NlpProcessor extends CommandParser
{
    private DeepSeekService $deepSeekService;
    private array $colloquialisms = [
        'verde' => 'regular',
        'magna' => 'regular',
        'roja' => 'premium',
        'gasofa' => 'diesel',
        'nafta' => 'regular',
        'super' => 'premium'
    ];
    
    private array $intentPhrases = [
        'cuánto anda' => 'price_query',
        'a cómo está' => 'price_query',
        'qué tal está' => 'price_query',
        'cuánto cuesta' => 'price_query',
        'cuánto vale' => 'price_query',
        'cuánto cobran' => 'price_query',
        'precio de' => 'price_query',
        'dónde está' => 'station_search',
        'dónde queda' => 'station_search',
        'dónde hay' => 'station_search',
        'cerca de' => 'station_search',
        'gasolinera más' => 'station_search'
    ];

    public function __construct(DeepSeekService $deepSeekService)
    {
        $this->deepSeekService = $deepSeekService;
    }

    public function process(string $text, array $context = []): array
    {
        $normalized = $this->normalizeText($text);
        $corrected = $this->correctTypos($normalized);
        $mapped = $this->mapColloquialisms($corrected);
        
        $intent = $this->extractIntent($mapped);
        $entities = $this->extractEntities($mapped);
        $confidence = $this->calculateConfidence($intent, $entities);
        
        if ($confidence < config('deepseek.confidence_threshold', 0.7)) {
            try {
                if ($this->deepSeekService->isAvailable()) {
                    $deepSeekResult = $this->deepSeekService->analyze($text, $context);
                    
                    if (isset($deepSeekResult['confidence']) && $deepSeekResult['confidence'] > $confidence) {
                        return [
                            'original_query' => $text,
                            'normalized_query' => $mapped,
                            'intent' => $deepSeekResult['intent'] ?? $intent,
                            'entities' => $deepSeekResult['entities'] ?? $entities,
                            'confidence' => $deepSeekResult['confidence'],
                            'suggested_command' => $deepSeekResult['suggested_command'] ?? null,
                            'used_deepseek' => true,
                            'response_time_ms' => $deepSeekResult['response_time_ms'] ?? null
                        ];
                    }
                }
            } catch (\Exception $e) {
                Log::warning('DeepSeek analysis failed, using local processing', [
                    'error' => $e->getMessage(),
                    'query' => $text
                ]);
            }
        }
        
        return [
            'original_query' => $text,
            'normalized_query' => $mapped,
            'intent' => $intent,
            'entities' => $entities,
            'confidence' => $confidence,
            'suggested_command' => $this->suggestCommand($intent, $entities),
            'used_deepseek' => false,
            'response_time_ms' => null
        ];
    }

    private function normalizeText(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[¿¡]/u', '', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }

    private function correctTypos(string $text): string
    {
        $corrections = [
            'gsolina' => 'gasolina',
            'gasoilna' => 'gasolina',
            'diesl' => 'diesel',
            'disel' => 'diesel',
            'premiun' => 'premium',
            'premum' => 'premium',
            'magña' => 'magna',
            'precio' => 'precio',
            'presio' => 'precio',
            'precío' => 'precio',
            'quanto' => 'cuánto',
            'cuato' => 'cuánto',
            'estasion' => 'estación',
            'gasolineria' => 'gasolinera'
        ];
        
        foreach ($corrections as $typo => $correct) {
            if (str_contains($text, $typo)) {
                $text = str_replace($typo, $correct, $text);
            }
        }
        
        foreach ($corrections as $typo => $correct) {
            if ($this->levenshteinSimilarity($text, $typo) > 0.8) {
                $text = preg_replace('/\b' . preg_quote($typo, '/') . '\b/i', $correct, $text);
            }
        }
        
        return $text;
    }

    private function levenshteinSimilarity(string $str1, string $str2): float
    {
        $len1 = mb_strlen($str1);
        $len2 = mb_strlen($str2);
        $maxLen = max($len1, $len2);
        
        if ($maxLen === 0) {
            return 1.0;
        }
        
        $distance = levenshtein($str1, $str2);
        return 1 - ($distance / $maxLen);
    }

    private function mapColloquialisms(string $text): string
    {
        foreach ($this->colloquialisms as $colloquial => $standard) {
            if (str_contains($text, $colloquial)) {
                $text = preg_replace('/\b' . preg_quote($colloquial, '/') . '\b/i', $standard, $text);
            }
        }
        
        return $text;
    }

    private function extractIntent(string $text): string
    {
        foreach ($this->intentPhrases as $phrase => $intent) {
            if (str_contains($text, $phrase)) {
                return $intent;
            }
        }
        
        if (str_contains($text, 'precio') || str_contains($text, 'cuánto') || 
            str_contains($text, 'cuesta') || str_contains($text, 'vale')) {
            return 'price_query';
        }
        
        if (str_contains($text, 'dónde') || str_contains($text, 'estación') || 
            str_contains($text, 'gasolinera') || str_contains($text, 'cerca')) {
            return 'station_search';
        }
        
        if (str_contains($text, 'ayuda') || str_contains($text, 'help') || 
            str_contains($text, 'cómo')) {
            return 'help';
        }
        
        return 'unknown';
    }

    private function extractEntities(string $text): array
    {
        $entities = [
            'fuel_type' => $this->extractFuelType($text),
            'location' => $this->extractLocation($text),
            'time_period' => $this->extractTimePeriod($text),
            'station_name' => $this->extractStationName($text)
        ];
        
        return array_filter($entities);
    }

    private function extractLocation(string $text): ?string
    {
        $locationKeywords = [
            'centro' => 'centro',
            'norte' => 'norte',
            'sur' => 'sur',
            'este' => 'este',
            'oeste' => 'oeste',
            'cerca' => 'nearby',
            'aquí' => 'here',
            'mi ubicación' => 'current_location'
        ];
        
        foreach ($locationKeywords as $keyword => $location) {
            if (str_contains($text, $keyword)) {
                return $location;
            }
        }
        
        return null;
    }

    private function calculateConfidence(string $intent, array $entities): float
    {
        $confidence = 0.0;
        $weights = [
            'intent' => 0.4,
            'entities' => 0.3,
            'entity_relevance' => 0.3
        ];
        
        // Base confidence from intent
        if ($intent !== 'unknown') {
            $confidence += $weights['intent'];
            
            // Bonus for very clear intents
            if (in_array($intent, ['price_query', 'station_search', 'help'])) {
                $confidence += 0.1;
            }
        }
        
        // Confidence from entities
        if (!empty($entities)) {
            $entityScore = min(count($entities) * 0.15, $weights['entities']);
            $confidence += $entityScore;
        }
        
        // Entity relevance bonus
        $relevanceScore = 0.0;
        switch ($intent) {
            case 'price_query':
                if (isset($entities['fuel_type'])) {
                    $relevanceScore += 0.2;
                }
                if (isset($entities['time_period'])) {
                    $relevanceScore += 0.1;
                }
                break;
                
            case 'station_search':
                if (isset($entities['location']) || isset($entities['station_name'])) {
                    $relevanceScore += 0.25;
                }
                break;
                
            case 'help':
                $relevanceScore += 0.2; // Help intent is usually clear
                break;
        }
        
        $confidence += min($relevanceScore, $weights['entity_relevance']);
        
        // Ensure confidence is between 0 and 1
        return round(min(max($confidence, 0.0), 1.0), 2);
    }

    private function suggestCommand(string $intent, array $entities): ?string
    {
        switch ($intent) {
            case 'price_query':
                $fuelType = $entities['fuel_type'] ?? 'regular';
                return "/precio {$fuelType}";
                
            case 'station_search':
                if (isset($entities['station_name'])) {
                    return "/buscar {$entities['station_name']}";
                }
                return "/cercanas";
                
            case 'help':
                return "/ayuda";
                
            default:
                return null;
        }
    }

    public function mergeContext(array $currentContext, array $newData): array
    {
        $merged = array_merge($currentContext, $newData);
        
        if (isset($newData['entities'])) {
            $merged['entities'] = array_merge(
                $currentContext['entities'] ?? [],
                $newData['entities']
            );
        }
        
        if (!isset($newData['fuel_type']) && isset($currentContext['fuel_type'])) {
            $merged['fuel_type'] = $currentContext['fuel_type'];
        }
        
        if (!isset($newData['location']) && isset($currentContext['location'])) {
            $merged['location'] = $currentContext['location'];
        }
        
        $merged['last_intent'] = $newData['intent'] ?? $currentContext['last_intent'] ?? null;
        $merged['conversation_turn'] = ($currentContext['conversation_turn'] ?? 0) + 1;
        $merged['updated_at'] = time();
        
        return $merged;
    }

    public function isFollowUpQuery(string $text): bool
    {
        $followUpIndicators = [
            'y la', 'y el', 'también', 'tambien',
            'además', 'ademas', 'otra', 'otro',
            'qué hay de', 'que hay de', 'y de',
            'y para', 'y en'
        ];
        
        $normalized = $this->normalizeText($text);
        
        foreach ($followUpIndicators as $indicator) {
            if (str_starts_with($normalized, $indicator)) {
                return true;
            }
        }
        
        return false;
    }
}