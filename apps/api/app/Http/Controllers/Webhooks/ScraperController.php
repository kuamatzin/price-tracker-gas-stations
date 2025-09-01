<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Services\ScraperRunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ScraperController extends Controller
{
    public function __construct(
        private ScraperRunService $scraperRunService
    ) {}

    /**
     * Handle scraper completion webhook
     */
    public function complete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'started_at' => 'required|date',
            'completed_at' => 'required|date',
            'status' => 'required|in:completed,failed',
            'statistics' => 'required|array',
            'statistics.estados_processed' => 'integer',
            'statistics.municipios_processed' => 'integer',
            'statistics.stations_found' => 'integer',
            'statistics.price_changes_detected' => 'integer',
            'statistics.new_stations_added' => 'integer',
            'statistics.errors_encountered' => 'integer',
            'errors' => 'array',
            'errors.*.type' => 'string',
            'errors.*.endpoint' => 'string',
            'errors.*.message' => 'string',
            'errors.*.estado_id' => 'integer',
        ]);

        try {
            $scraperRun = $this->scraperRunService->recordRun($validated);

            Log::info('Scraper webhook received', [
                'scraper_run_id' => $scraperRun->id,
                'status' => $validated['status'],
                'price_changes' => $validated['statistics']['price_changes_detected'] ?? 0,
            ]);

            $nextRun = now()->addDay()->startOfDay()->addHours(5); // 5 AM tomorrow

            return response()->json([
                'status' => 'success',
                'scraper_run_id' => $scraperRun->id,
                'next_run_scheduled' => $nextRun->toIso8601String(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to process scraper webhook', [
                'error' => $e->getMessage(),
                'payload' => $validated,
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to process webhook',
            ], 500);
        }
    }
}
