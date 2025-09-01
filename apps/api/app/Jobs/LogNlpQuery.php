<?php

namespace App\Jobs;

use App\Repositories\NlpQueryRepository;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class LogNlpQuery implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected array $queryData;

    /**
     * Create a new job instance
     */
    public function __construct(array $queryData)
    {
        $this->queryData = $queryData;
    }

    /**
     * Execute the job
     */
    public function handle(NlpQueryRepository $repository): void
    {
        try {
            $repository->create($this->queryData);

            // Log for analytics if confidence is very low
            if (($this->queryData['confidence'] ?? 0) < 0.5) {
                Log::channel('nlp')->warning('Low confidence NLP query', [
                    'query' => $this->queryData['original_query'],
                    'confidence' => $this->queryData['confidence'],
                    'intent' => $this->queryData['interpreted_intent'] ?? 'unknown',
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to log NLP query', [
                'error' => $e->getMessage(),
                'data' => $this->queryData,
            ]);

            // Don't throw - we don't want to retry logging failures
        }
    }

    /**
     * Get the tags that should be assigned to the job
     */
    public function tags(): array
    {
        return ['nlp', 'logging'];
    }
}
