<?php

namespace App\Repositories;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class NlpQueryRepository
{
    protected string $table = 'nlp_queries';

    /**
     * Create a new NLP query record
     */
    public function create(array $data): int
    {
        return DB::table($this->table)->insertGetId([
            'user_id' => $data['user_id'] ?? null,
            'chat_id' => $data['chat_id'],
            'original_query' => $data['original_query'],
            'normalized_query' => $data['normalized_query'] ?? null,
            'interpreted_intent' => $data['interpreted_intent'] ?? null,
            'extracted_entities' => isset($data['extracted_entities']) ? json_encode($data['extracted_entities']) : null,
            'confidence' => $data['confidence'] ?? null,
            'response_time_ms' => $data['response_time_ms'] ?? null,
            'used_deepseek' => $data['used_deepseek'] ?? false,
            'command_executed' => $data['command_executed'] ?? null,
            'success' => $data['success'] ?? null,
            'fallback_suggested' => isset($data['fallback_suggested']) ? json_encode($data['fallback_suggested']) : null,
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    /**
     * Update query result
     */
    public function updateResult(int $id, string $commandExecuted, bool $success): void
    {
        DB::table($this->table)
            ->where('id', $id)
            ->update([
                'command_executed' => $commandExecuted,
                'success' => $success,
                'updated_at' => now()
            ]);
    }

    /**
     * Get unrecognized queries (low confidence or unknown intent)
     */
    public function getUnrecognizedQueries(int $hours = 24): Collection
    {
        return DB::table($this->table)
            ->where('created_at', '>=', now()->subHours($hours))
            ->where(function ($query) {
                $query->where('confidence', '<', 0.7)
                      ->orWhere('interpreted_intent', 'unknown')
                      ->orWhereNull('interpreted_intent');
            })
            ->select([
                'original_query',
                'normalized_query',
                'interpreted_intent',
                'confidence',
                DB::raw('COUNT(*) as occurrence_count')
            ])
            ->groupBy('original_query', 'normalized_query', 'interpreted_intent', 'confidence')
            ->orderBy('occurrence_count', 'desc')
            ->limit(50)
            ->get();
    }

    /**
     * Get query statistics for analytics
     */
    public function getStatistics(int $hours = 24): array
    {
        $since = now()->subHours($hours);
        
        $stats = DB::table($this->table)
            ->where('created_at', '>=', $since)
            ->selectRaw('
                COUNT(*) as total_queries,
                AVG(confidence) as avg_confidence,
                AVG(response_time_ms) as avg_response_time,
                SUM(CASE WHEN used_deepseek = true THEN 1 ELSE 0 END) as deepseek_count,
                SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_queries,
                COUNT(DISTINCT chat_id) as unique_users
            ')
            ->first();
        
        $intentBreakdown = DB::table($this->table)
            ->where('created_at', '>=', $since)
            ->whereNotNull('interpreted_intent')
            ->select('interpreted_intent', DB::raw('COUNT(*) as count'))
            ->groupBy('interpreted_intent')
            ->orderBy('count', 'desc')
            ->get()
            ->pluck('count', 'interpreted_intent')
            ->toArray();
        
        return [
            'total_queries' => $stats->total_queries ?? 0,
            'avg_confidence' => round($stats->avg_confidence ?? 0, 2),
            'avg_response_time_ms' => round($stats->avg_response_time ?? 0),
            'deepseek_usage_rate' => $stats->total_queries > 0 
                ? round(($stats->deepseek_count / $stats->total_queries) * 100, 2) 
                : 0,
            'success_rate' => $stats->total_queries > 0 
                ? round(($stats->successful_queries / $stats->total_queries) * 100, 2) 
                : 0,
            'unique_users' => $stats->unique_users ?? 0,
            'intent_breakdown' => $intentBreakdown
        ];
    }

    /**
     * Get queries by user
     */
    public function getByUser(int $userId, int $limit = 10): Collection
    {
        return DB::table($this->table)
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get queries by chat
     */
    public function getByChat(string $chatId, int $limit = 10): Collection
    {
        return DB::table($this->table)
            ->where('chat_id', $chatId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get popular queries
     */
    public function getPopularQueries(int $hours = 24, int $limit = 20): Collection
    {
        return DB::table($this->table)
            ->where('created_at', '>=', now()->subHours($hours))
            ->where('success', true)
            ->select([
                'normalized_query',
                'interpreted_intent',
                DB::raw('COUNT(*) as query_count'),
                DB::raw('AVG(confidence) as avg_confidence')
            ])
            ->groupBy('normalized_query', 'interpreted_intent')
            ->having('query_count', '>', 1)
            ->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Clean old records
     */
    public function cleanOldRecords(int $days = 30): int
    {
        return DB::table($this->table)
            ->where('created_at', '<', now()->subDays($days))
            ->delete();
    }
}