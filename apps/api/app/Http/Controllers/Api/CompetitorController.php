<?php

namespace App\Http\Controllers\Api;

use App\Services\CompetitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CompetitorController extends BaseApiController
{
    protected CompetitorService $competitorService;

    public function __construct(CompetitorService $competitorService)
    {
        $this->competitorService = $competitorService;
    }

    /**
     * @OA\Get(
     *     path="/api/v1/competitors",
     *     operationId="getCompetitors",
     *     tags={"Competitors"},
     *     summary="Get competitor analysis",
     *     description="Returns competitor stations and price comparisons for selected station",
     *     security={{"sanctum":{}}},
     *
     *     @OA\Parameter(
     *         name="station_numero",
     *         in="query",
     *         description="Station number",
     *         required=true,
     *
     *         @OA\Schema(type="string", example="E12345")
     *     ),
     *
     *     @OA\Parameter(
     *         name="radius",
     *         in="query",
     *         description="Search radius in kilometers",
     *         required=false,
     *
     *         @OA\Schema(type="number", minimum=1, maximum=50, default=5, example=5)
     *     ),
     *
     *     @OA\Parameter(
     *         name="mode",
     *         in="query",
     *         description="Search mode",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"radius", "municipio", "combined"}, default="radius")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="user_station", type="object"),
     *                 @OA\Property(property="settings", type="object"),
     *                 @OA\Property(property="competitors", type="array",
     *
     *                     @OA\Items(type="object")
     *                 ),
     *
     *                 @OA\Property(property="total_competitors", type="integer")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - user has no associated station",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="error", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Station not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="error", type="object")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'station_numero' => 'required|string|exists:stations,numero',
            'radius' => 'nullable|numeric|min:1|max:50',
            'mode' => 'nullable|in:radius,municipio,combined',
        ]);

        $stationNumero = $request->input('station_numero');
        $mode = $request->input('mode', 'radius');
        $radius = $request->input('radius', 5);

        $cacheKey = "competitors:{$stationNumero}:{$mode}:{$radius}";

        $data = Cache::remember($cacheKey, 900, function () use ($stationNumero, $mode, $radius) {
            $station = $this->competitorService->getUserStation($stationNumero);

            if (! $station) {
                return null;
            }

            $competitors = $this->competitorService->getCompetitors($station, $mode, $radius);

            return [
                'user_station' => [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                ],
                'settings' => [
                    'mode' => $mode,
                    'radius_km' => $radius,
                ],
                'competitors' => $competitors,
                'total_competitors' => count($competitors),
            ];
        });

        if (! $data) {
            return $this->notFoundResponse('Station not found');
        }

        return $this->successResponse($data);
    }
}
