<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\TrendRequest;
use App\Http\Requests\MarketTrendRequest;
use App\Services\TrendAnalysisService;
use App\Services\MarketAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class TrendController extends BaseApiController
{
    public function __construct(
        private TrendAnalysisService $trendService,
        private MarketAggregationService $marketService
    ) {}

    /**
     * @OA\Get(
     *     path="/api/v1/trends/station/{stationId}",
     *     operationId="getStationTrends",
     *     tags={"Trends"},
     *     summary="Get price trends for a station",
     *     description="Returns historical price trends for a specific station",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="stationId",
     *         in="path",
     *         description="Station ID",
     *         required=true,
     *         @OA\Schema(type="string", example="12345")
     *     ),
     *     @OA\Parameter(
     *         name="start_date",
     *         in="query",
     *         description="Start date (YYYY-MM-DD)",
     *         required=true,
     *         @OA\Schema(type="string", format="date", example="2024-01-01")
     *     ),
     *     @OA\Parameter(
     *         name="end_date",
     *         in="query",
     *         description="End date (YYYY-MM-DD)",
     *         required=true,
     *         @OA\Schema(type="string", format="date", example="2024-01-31")
     *     ),
     *     @OA\Parameter(
     *         name="period",
     *         in="query",
     *         description="Period for moving average (days)",
     *         required=false,
     *         @OA\Schema(type="integer", default=7, example=7)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object")
     *         )
     *     )
     * )
     */
    public function getStationTrends(string $stationId, TrendRequest $request): JsonResponse
    {
        $validated = $request->validated();
        
        $cacheKey = "trends:station:{$stationId}:" . md5(json_encode($validated));
        $ttl = 3600; // 1 hour for trend calculations
        
        $trends = Cache::remember($cacheKey, $ttl, function () use ($stationId, $validated) {
            return $this->trendService->calculateStationTrends(
                $stationId,
                $validated['start_date'],
                $validated['end_date'],
                $validated['period'] ?? 7
            );
        });
        
        return $this->successResponse($trends);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/trends/market",
     *     operationId="getMarketTrends",
     *     tags={"Trends"},
     *     summary="Get market price trends",
     *     description="Returns aggregated market price trends for a region",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="entidad_id",
     *         in="query",
     *         description="State ID",
     *         required=false,
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *     @OA\Parameter(
     *         name="municipio_id",
     *         in="query",
     *         description="Municipality ID",
     *         required=false,
     *         @OA\Schema(type="integer", example=123)
     *     ),
     *     @OA\Parameter(
     *         name="start_date",
     *         in="query",
     *         description="Start date (YYYY-MM-DD)",
     *         required=true,
     *         @OA\Schema(type="string", format="date", example="2024-01-01")
     *     ),
     *     @OA\Parameter(
     *         name="end_date",
     *         in="query",
     *         description="End date (YYYY-MM-DD)",
     *         required=true,
     *         @OA\Schema(type="string", format="date", example="2024-01-31")
     *     ),
     *     @OA\Parameter(
     *         name="grouping",
     *         in="query",
     *         description="Data grouping period",
     *         required=false,
     *         @OA\Schema(type="string", enum={"daily", "weekly", "monthly"}, default="daily")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object")
     *         )
     *     )
     * )
     */
    public function getMarketTrends(MarketTrendRequest $request): JsonResponse
    {
        $validated = $request->validated();
        
        $cacheKey = "trends:market:" . md5(json_encode($validated));
        $ttl = 3600; // 1 hour for market aggregations
        
        $trends = Cache::remember($cacheKey, $ttl, function () use ($validated) {
            return $this->marketService->getMarketTrends(
                $validated['entidad_id'] ?? null,
                $validated['municipio_id'] ?? null,
                $validated['start_date'],
                $validated['end_date'],
                $validated['grouping'] ?? 'daily'
            );
        });
        
        return $this->successResponse($trends);
    }
}