<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\CurrentPricesRequest;
use App\Http\Requests\NearbyPricesRequest;
use App\Http\Resources\PriceCollection;
use App\Http\Resources\StationResource;
use App\Repositories\PriceRepository;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;

class PriceController extends BaseApiController
{
    public function __construct(
        private PriceRepository $priceRepository,
        private PricingService $pricingService
    ) {}

    /**
     * @OA\Get(
     *     path="/api/v1/prices/current",
     *     operationId="getCurrentPrices",
     *     tags={"Prices"},
     *     summary="Get current fuel prices",
     *     description="Returns latest fuel prices for all stations with optional filters",
     *     security={{"sanctum":{}}},
     *
     *     @OA\Parameter(
     *         name="entidad",
     *         in="query",
     *         description="Filter by state ID",
     *         required=false,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Parameter(
     *         name="municipio",
     *         in="query",
     *         description="Filter by municipality ID",
     *         required=false,
     *
     *         @OA\Schema(type="integer", example=123)
     *     ),
     *
     *     @OA\Parameter(
     *         name="brand",
     *         in="query",
     *         description="Filter by brand",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"Pemex", "Shell", "BP", "Chevron", "Mobil", "Exxon"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="fuel_type",
     *         in="query",
     *         description="Filter by fuel type",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"regular", "premium", "diesel"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="fresh",
     *         in="query",
     *         description="Force fresh data (bypass cache)",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", default=false)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Current prices retrieved successfully"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="error", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=429,
     *         description="Rate limit exceeded",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="error", type="object")
     *         )
     *     )
     * )
     */
    public function current(CurrentPricesRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $fresh = $request->boolean('fresh', false);

        $prices = $this->priceRepository->getCurrentPrices($filters, $fresh);

        return $this->successResponse(
            new PriceCollection($prices),
            'Current prices retrieved successfully'
        );
    }

    /**
     * @OA\Get(
     *     path="/api/v1/prices/station/{numero}",
     *     operationId="getStationPrices",
     *     tags={"Prices"},
     *     summary="Get prices for specific station",
     *     description="Returns current prices for a specific station",
     *     security={{"sanctum":{}}},
     *
     *     @OA\Parameter(
     *         name="numero",
     *         in="path",
     *         description="Station number",
     *         required=true,
     *
     *         @OA\Schema(type="string", example="12345")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Station prices retrieved successfully"),
     *             @OA\Property(property="data", type="object")
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
    public function station(string $numero): JsonResponse
    {
        $stationPrices = $this->priceRepository->getStationPrices($numero);

        if (! $stationPrices) {
            return $this->errorResponse('Station not found', 404);
        }

        return $this->successResponse(
            new StationResource($stationPrices),
            'Station prices retrieved successfully'
        );
    }

    /**
     * @OA\Post(
     *     path="/api/v1/prices/nearby",
     *     operationId="getNearbyPrices",
     *     tags={"Prices"},
     *     summary="Get nearby station prices",
     *     description="Returns prices for stations within specified radius of coordinates",
     *     security={{"sanctum":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"lat", "lng"},
     *
     *             @OA\Property(property="lat", type="number", format="float", example=19.4326),
     *             @OA\Property(property="lng", type="number", format="float", example=-99.1332),
     *             @OA\Property(property="radius", type="integer", description="Radius in kilometers", example=5),
     *             @OA\Property(property="fresh", type="boolean", description="Force fresh data", example=false)
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Nearby prices retrieved successfully"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=422,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="error", type="object")
     *         )
     *     )
     * )
     */
    public function nearby(NearbyPricesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $fresh = $request->boolean('fresh', false);

        $nearbyPrices = $this->priceRepository->getNearbyPrices(
            $data['lat'],
            $data['lng'],
            $data['radius'] ?? 5,
            $fresh
        );

        return $this->successResponse(
            new PriceCollection($nearbyPrices),
            'Nearby prices retrieved successfully'
        );
    }
}
