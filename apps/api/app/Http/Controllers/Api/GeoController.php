<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Repositories\GeographicRepository;
use App\Services\GeographicComparisonService;
use App\Services\HeatMapDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class GeoController extends Controller
{
    protected GeographicRepository $repository;
    protected GeographicComparisonService $comparisonService;
    protected HeatMapDataService $heatMapService;

    public function __construct(
        GeographicRepository $repository,
        GeographicComparisonService $comparisonService,
        HeatMapDataService $heatMapService
    ) {
        $this->repository = $repository;
        $this->comparisonService = $comparisonService;
        $this->heatMapService = $heatMapService;
    }

    /**
     * @OA\Get(
     *     path="/api/v1/geo/estados",
     *     operationId="getEstados",
     *     tags={"Geographic"},
     *     summary="Get state-level aggregated data",
     *     description="Returns aggregated fuel price data for all states",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="fuel_type",
     *         in="query",
     *         description="Filter by fuel type",
     *         required=false,
     *         @OA\Schema(type="string", enum={"regular", "premium", "diesel"})
     *     ),
     *     @OA\Parameter(
     *         name="sort_by",
     *         in="query",
     *         description="Sort field",
     *         required=false,
     *         @OA\Schema(type="string", enum={"avg_price", "min_price", "max_price", "station_count"})
     *     ),
     *     @OA\Parameter(
     *         name="sort_order",
     *         in="query",
     *         description="Sort order",
     *         required=false,
     *         @OA\Schema(type="string", enum={"asc", "desc"}, default="asc")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(type="object")),
     *             @OA\Property(property="summary", type="object")
     *         )
     *     )
     * )
     */
    public function estados(Request $request)
    {
        $filters = $request->only(['fuel_type', 'sort_by', 'sort_order']);
        $cacheKey = 'geo:estados:' . md5(json_encode($filters));
        
        $data = Cache::remember($cacheKey, 1800, function () use ($filters) {
            return $this->repository->getEstadoAggregates($filters);
        });

        return response()->json([
            'data' => $data['estados'],
            'summary' => $data['summary']
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/geo/estado/{estado}/municipios",
     *     operationId="getMunicipiosByEstado",
     *     tags={"Geographic"},
     *     summary="Get municipalities by state",
     *     description="Returns aggregated fuel price data for municipalities in a state",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="estado",
     *         in="path",
     *         description="State ID",
     *         required=true,
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *     @OA\Parameter(
     *         name="fuel_type",
     *         in="query",
     *         description="Filter by fuel type",
     *         required=false,
     *         @OA\Schema(type="string", enum={"regular", "premium", "diesel"})
     *     ),
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *         @OA\Schema(type="integer", minimum=1, default=1)
     *     ),
     *     @OA\Parameter(
     *         name="per_page",
     *         in="query",
     *         description="Items per page",
     *         required=false,
     *         @OA\Schema(type="integer", minimum=1, maximum=100, default=20)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(type="object")
     *     )
     * )
     */
    public function municipiosByEstado(Request $request, $estado)
    {
        $request->validate([
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:100'
        ]);

        $filters = array_merge(
            $request->only(['fuel_type', 'sort_by', 'sort_order']),
            ['estado' => $estado]
        );
        
        $cacheKey = 'geo:municipios:' . md5(json_encode($filters));
        
        $data = Cache::remember($cacheKey, 1800, function () use ($filters, $request) {
            return $this->repository->getMunicipiosByEstado(
                $filters['estado'],
                $filters,
                $request->get('page', 1),
                $request->get('per_page', 20)
            );
        });

        return response()->json($data);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/geo/municipio/{municipio}/stats",
     *     operationId="getMunicipioStats",
     *     tags={"Geographic"},
     *     summary="Get municipality statistics",
     *     description="Returns detailed statistics for a specific municipality",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="municipio",
     *         in="path",
     *         description="Municipality ID",
     *         required=true,
     *         @OA\Schema(type="integer", example=123)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Municipality not found",
     *         @OA\JsonContent(
     *             @OA\Property(property="error", type="string")
     *         )
     *     )
     * )
     */
    public function municipioStats(Request $request, $municipio)
    {
        $cacheKey = 'geo:stats:' . $municipio;
        
        $data = Cache::remember($cacheKey, 1800, function () use ($municipio) {
            return $this->repository->getMunicipioStats($municipio);
        });

        if (!$data) {
            return response()->json(['error' => 'Municipio not found'], 404);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * @OA\Post(
     *     path="/api/v1/geo/compare",
     *     operationId="compareAreas",
     *     tags={"Geographic"},
     *     summary="Compare geographic areas",
     *     description="Compare fuel prices across multiple states or municipalities",
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"areas"},
     *             @OA\Property(
     *                 property="areas",
     *                 type="array",
     *                 minItems=2,
     *                 @OA\Items(
     *                     type="object",
     *                     required={"type", "id"},
     *                     @OA\Property(property="type", type="string", enum={"estado", "municipio"}),
     *                     @OA\Property(property="id", type="integer")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="fuel_types",
     *                 type="array",
     *                 @OA\Items(type="string", enum={"regular", "premium", "diesel"})
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="object")
     *         )
     *     )
     * )
     */
    public function compare(Request $request)
    {
        $request->validate([
            'areas' => 'required|array|min:2',
            'areas.*.type' => 'required|in:estado,municipio',
            'areas.*.id' => 'required|integer',
            'fuel_types' => 'array',
            'fuel_types.*' => 'in:regular,premium,diesel'
        ]);

        $areas = $request->input('areas');
        $fuelTypes = $request->input('fuel_types', ['regular', 'premium', 'diesel']);
        
        $cacheKey = 'geo:compare:' . md5(json_encode([$areas, $fuelTypes]));
        
        $data = Cache::remember($cacheKey, 1800, function () use ($areas, $fuelTypes) {
            return $this->comparisonService->compareAreas($areas, $fuelTypes);
        });

        return response()->json(['data' => $data]);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/geo/heatmap",
     *     operationId="getHeatmap",
     *     tags={"Geographic"},
     *     summary="Get price heatmap data",
     *     description="Returns heatmap data for fuel prices within geographic bounds",
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(
     *         name="north",
     *         in="query",
     *         description="Northern boundary latitude",
     *         required=true,
     *         @OA\Schema(type="number", format="float", minimum=-90, maximum=90)
     *     ),
     *     @OA\Parameter(
     *         name="south",
     *         in="query",
     *         description="Southern boundary latitude",
     *         required=true,
     *         @OA\Schema(type="number", format="float", minimum=-90, maximum=90)
     *     ),
     *     @OA\Parameter(
     *         name="east",
     *         in="query",
     *         description="Eastern boundary longitude",
     *         required=true,
     *         @OA\Schema(type="number", format="float", minimum=-180, maximum=180)
     *     ),
     *     @OA\Parameter(
     *         name="west",
     *         in="query",
     *         description="Western boundary longitude",
     *         required=true,
     *         @OA\Schema(type="number", format="float", minimum=-180, maximum=180)
     *     ),
     *     @OA\Parameter(
     *         name="zoom",
     *         in="query",
     *         description="Map zoom level",
     *         required=true,
     *         @OA\Schema(type="integer", minimum=1, maximum=20)
     *     ),
     *     @OA\Parameter(
     *         name="fuel_type",
     *         in="query",
     *         description="Fuel type for heatmap",
     *         required=false,
     *         @OA\Schema(type="string", enum={"regular", "premium", "diesel"}, default="regular")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="object")
     *         )
     *     )
     * )
     */
    public function heatmap(Request $request)
    {
        $request->validate([
            'north' => 'required|numeric|between:-90,90',
            'south' => 'required|numeric|between:-90,90',
            'east' => 'required|numeric|between:-180,180',
            'west' => 'required|numeric|between:-180,180',
            'zoom' => 'required|integer|between:1,20',
            'fuel_type' => 'in:regular,premium,diesel'
        ]);

        $bounds = $request->only(['north', 'south', 'east', 'west']);
        $zoomLevel = $request->input('zoom');
        $fuelType = $request->input('fuel_type', 'regular');
        
        $cacheKey = sprintf(
            'geo:heatmap:%s:%s:%s:%s:%d:%s',
            $bounds['north'],
            $bounds['south'],
            $bounds['east'],
            $bounds['west'],
            $zoomLevel,
            $fuelType
        );
        
        $data = Cache::remember($cacheKey, 1800, function () use ($bounds, $zoomLevel, $fuelType) {
            return $this->heatMapService->generateHeatMap($bounds, $zoomLevel, $fuelType);
        });

        return response()->json(['data' => $data]);
    }
}