<?php

namespace App\Http\Controllers\Api;

use App\Services\CompetitorService;
use App\Services\PriceRankingService;
use App\Services\RecommendationEngine;
use App\Services\SpreadAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AnalysisController extends BaseApiController
{
    protected CompetitorService $competitorService;

    protected PriceRankingService $rankingService;

    protected SpreadAnalysisService $spreadService;

    protected RecommendationEngine $recommendationEngine;

    public function __construct(
        CompetitorService $competitorService,
        PriceRankingService $rankingService,
        SpreadAnalysisService $spreadService,
        RecommendationEngine $recommendationEngine
    ) {
        $this->competitorService = $competitorService;
        $this->rankingService = $rankingService;
        $this->spreadService = $spreadService;
        $this->recommendationEngine = $recommendationEngine;
    }

    public function ranking(Request $request): JsonResponse
    {
        $user = $request->user();
        $stationNumero = $request->input('station_numero');

        if (!$stationNumero) {
            return $this->errorResponse('station_numero is required', 422);
        }

        // Verify user has access to this station
        if (!$user->stations()->where('station_numero', $stationNumero)->exists()) {
            return $this->errorResponse('Unauthorized access to station', 403);
        }

        $cacheKey = "analysis:ranking:{$stationNumero}:".date('Y-m-d-H');

        $data = Cache::remember($cacheKey, 900, function () use ($stationNumero) {
            $station = $this->competitorService->getUserStation($stationNumero);

            if (! $station) {
                return null;
            }

            $competitors = $this->competitorService->getCompetitors($station);
            $rankings = $this->rankingService->calculateRankings($station, $competitors);

            return [
                'station' => [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                ],
                'rankings' => $rankings,
                'overall_position' => $this->rankingService->getOverallPosition($rankings),
            ];
        });

        if (! $data) {
            return $this->notFoundResponse('Station not found');
        }

        return $this->successResponse($data);
    }

    public function spread(Request $request): JsonResponse
    {
        $user = $request->user();
        $stationNumero = $request->input('station_numero');

        if (!$stationNumero) {
            return $this->errorResponse('station_numero is required', 422);
        }

        // Verify user has access to this station
        if (!$user->stations()->where('station_numero', $stationNumero)->exists()) {
            return $this->errorResponse('Unauthorized access to station', 403);
        }

        $cacheKey = "analysis:spread:{$stationNumero}:".date('Y-m-d-H');

        $data = Cache::remember($cacheKey, 900, function () use ($stationNumero) {
            $station = $this->competitorService->getUserStation($stationNumero);

            if (! $station) {
                return null;
            }

            $competitors = $this->competitorService->getCompetitors($station);
            $analysis = $this->spreadService->analyzeAllFuelTypes($station, $competitors);
            $recommendations = $this->recommendationEngine->generateRecommendations($analysis);

            return [
                'analysis' => $analysis,
                'recommendations' => $recommendations,
            ];
        });

        if (! $data) {
            return $this->notFoundResponse('Station not found');
        }

        return $this->successResponse($data);
    }

    public function insights(Request $request): JsonResponse
    {
        $user = $request->user();
        $stationNumero = $request->input('station_numero');

        if (!$stationNumero) {
            return $this->errorResponse('station_numero is required', 422);
        }

        // Verify user has access to this station
        if (!$user->stations()->where('station_numero', $stationNumero)->exists()) {
            return $this->errorResponse('Unauthorized access to station', 403);
        }

        $cacheKey = "analysis:insights:{$stationNumero}:".date('Y-m-d-H');

        $data = Cache::remember($cacheKey, 900, function () use ($stationNumero) {
            $station = $this->competitorService->getUserStation($stationNumero);

            if (! $station) {
                return null;
            }

            $competitors = $this->competitorService->getCompetitors($station);
            $insights = $this->competitorService->getCompetitiveInsights($station, $competitors);

            return $insights;
        });

        if (! $data) {
            return $this->notFoundResponse('Station not found');
        }

        return $this->successResponse($data);
    }
}
