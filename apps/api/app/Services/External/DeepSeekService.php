<?php

namespace App\Services\External;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Exceptions\ExternalServiceException;

class DeepSeekService
{
    private string $apiKey;
    private string $apiUrl;
    private string $model;
    private int $maxTokens;
    private float $temperature;
    private int $timeout;
    private int $maxRetries = 3;
    private float $retryDelay = 0.5;
    
    // Circuit breaker properties
    private static int $failureCount = 0;
    private static ?int $lastFailureTime = null;
    private static int $circuitBreakerThreshold = 5;
    private static int $circuitBreakerResetTime = 300; // 5 minutes

    public function __construct()
    {
        $this->apiKey = config('deepseek.api_key');
        $this->apiUrl = config('deepseek.api_url');
        $this->model = config('deepseek.model');
        $this->maxTokens = config('deepseek.max_tokens');
        $this->temperature = config('deepseek.temperature');
        $this->timeout = config('deepseek.timeout_seconds');
    }

    public function analyze(string $query, array $context = []): array
    {
        $cacheKey = $this->getCacheKey($query, $context);
        
        return Cache::remember($cacheKey, 300, function () use ($query, $context) {
            return $this->sendRequest($query, $context);
        });
    }

    private function sendRequest(string $query, array $context): array
    {
        // Check circuit breaker
        if ($this->isCircuitOpen()) {
            throw new ExternalServiceException(
                'DeepSeek API circuit breaker is open - too many failures',
                503
            );
        }
        
        $systemPrompt = $this->buildSystemPrompt($context);
        $attempt = 0;
        $lastException = null;

        while ($attempt < $this->maxRetries) {
            try {
                $startTime = microtime(true);
                
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->timeout($this->timeout)
                ->post($this->apiUrl . '/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $query]
                    ],
                    'temperature' => $this->temperature,
                    'max_tokens' => $this->maxTokens,
                    'response_format' => ['type' => 'json_object']
                ]);

                $responseTime = (microtime(true) - $startTime) * 1000;

                if (!$response->successful()) {
                    throw new ExternalServiceException(
                        'DeepSeek API error: ' . $response->body(),
                        $response->status()
                    );
                }

                $data = $response->json();
                
                if (!isset($data['choices'][0]['message']['content'])) {
                    throw new ExternalServiceException('Invalid DeepSeek response structure');
                }

                $content = json_decode($data['choices'][0]['message']['content'], true);
                
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new ExternalServiceException('Invalid JSON in DeepSeek response');
                }

                // Reset circuit breaker on success
                $this->recordSuccess();
                
                return array_merge($content, [
                    'response_time_ms' => (int) $responseTime,
                    'attempt' => $attempt + 1
                ]);

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $this->recordFailure();
                $lastException = $e;
                $attempt++;
                
                if ($attempt < $this->maxRetries) {
                    $delay = $this->retryDelay * pow(2, $attempt - 1);
                    usleep((int)($delay * 1000000));
                    continue;
                }
            } catch (\Exception $e) {
                Log::error('DeepSeek API error', [
                    'error' => $e->getMessage(),
                    'query' => $query,
                    'attempt' => $attempt + 1
                ]);
                throw $e;
            }
        }

        Log::error('DeepSeek API max retries exceeded', [
            'error' => $lastException ? $lastException->getMessage() : 'Unknown error',
            'query' => $query
        ]);

        throw new ExternalServiceException(
            'DeepSeek API unavailable after ' . $this->maxRetries . ' attempts',
            503
        );
    }

    private function buildSystemPrompt(array $context): string
    {
        $basePrompt = "Eres un asistente experto en análisis de precios de gasolina en México. ";
        $basePrompt .= "Tu tarea es interpretar consultas en español mexicano sobre precios de combustible. ";
        $basePrompt .= "Debes extraer la intención del usuario y las entidades relevantes. ";
        $basePrompt .= "Responde SIEMPRE en formato JSON con la siguiente estructura: ";
        $basePrompt .= '{"intent": "string", "entities": {"fuel_type": "string or null", "location": "string or null", "other": {}}, "confidence": 0.0-1.0, "suggested_command": "string or null"}. ';
        $basePrompt .= "Los tipos de combustible válidos son: regular, premium, diesel. ";
        $basePrompt .= "Mapea los coloquialismos: magna/verde -> regular, roja -> premium, gasofa -> diesel. ";
        $basePrompt .= "Las intenciones principales son: price_query, station_search, help, unknown.";

        if (!empty($context)) {
            $basePrompt .= " Contexto de la conversación: " . json_encode($context, JSON_UNESCAPED_UNICODE);
        }

        return $basePrompt;
    }

    private function getCacheKey(string $query, array $context): string
    {
        $normalized = mb_strtolower(trim($query));
        $contextHash = md5(json_encode($context));
        return 'deepseek:' . md5($normalized . ':' . $contextHash);
    }

    public function isAvailable(): bool
    {
        // Check circuit breaker first
        if ($this->isCircuitOpen()) {
            return false;
        }
        
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
            ])
            ->timeout(2)
            ->get($this->apiUrl . '/models');

            return $response->successful();
        } catch (\Exception $e) {
            Log::warning('DeepSeek availability check failed', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Check if circuit breaker is open
     */
    private function isCircuitOpen(): bool
    {
        // Reset if enough time has passed since last failure
        if (self::$lastFailureTime && 
            (time() - self::$lastFailureTime) > self::$circuitBreakerResetTime) {
            self::$failureCount = 0;
            self::$lastFailureTime = null;
        }
        
        return self::$failureCount >= self::$circuitBreakerThreshold;
    }
    
    /**
     * Record a successful API call
     */
    private function recordSuccess(): void
    {
        if (self::$failureCount > 0) {
            self::$failureCount = max(0, self::$failureCount - 1);
        }
    }
    
    /**
     * Record a failed API call
     */
    private function recordFailure(): void
    {
        self::$failureCount++;
        self::$lastFailureTime = time();
        
        if (self::$failureCount >= self::$circuitBreakerThreshold) {
            Log::warning('DeepSeek circuit breaker triggered', [
                'failure_count' => self::$failureCount,
                'threshold' => self::$circuitBreakerThreshold
            ]);
        }
    }
}