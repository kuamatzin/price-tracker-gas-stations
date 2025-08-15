<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\HistoryRequest;
use App\Repositories\HistoricalDataRepository;
use App\Services\ChartFormatterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class HistoryController extends BaseApiController
{
    public function __construct(
        private HistoricalDataRepository $historicalRepo,
        private ChartFormatterService $chartFormatter
    ) {}

    public function getStationHistory(string $stationId, HistoryRequest $request): JsonResponse
    {
        $validated = $request->validated();
        
        $cacheKey = "history:station:{$stationId}:" . md5(json_encode($validated));
        $ttl = 300; // 5 minutes for history data
        
        $data = Cache::remember($cacheKey, $ttl, function () use ($stationId, $validated) {
            $history = $this->historicalRepo->getStationHistory(
                $stationId,
                $validated['start_date'],
                $validated['end_date'],
                $validated['fuel_type'] ?? null
            );
            
            return $this->chartFormatter->formatTimeSeries($history, $validated['grouping'] ?? 'daily');
        });
        
        return $this->successResponse($data);
    }
}