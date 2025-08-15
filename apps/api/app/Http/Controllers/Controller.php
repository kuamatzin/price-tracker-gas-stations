<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

/**
 * @OA\Info(
 *     title="FuelIntel API Documentation",
 *     version="1.0.0",
 *     description="REST API for Mexican fuel price intelligence",
 *     @OA\Contact(
 *         email="api@fuelintel.mx",
 *         name="FuelIntel Support"
 *     ),
 *     @OA\License(
 *         name="Proprietary",
 *         url="https://fuelintel.mx/terms"
 *     )
 * )
 * @OA\Server(
 *     url=L5_SWAGGER_CONST_HOST,
 *     description="FuelIntel API Server"
 * )
 * @OA\SecurityScheme(
 *     securityScheme="sanctum",
 *     type="http",
 *     scheme="bearer",
 *     bearerFormat="token",
 *     description="Laravel Sanctum token authentication"
 * )
 * @OA\Tag(
 *     name="Authentication",
 *     description="API authentication endpoints"
 * )
 * @OA\Tag(
 *     name="Prices",
 *     description="Fuel price endpoints"
 * )
 * @OA\Tag(
 *     name="Trends",
 *     description="Price trend analysis endpoints"
 * )
 * @OA\Tag(
 *     name="Competitors",
 *     description="Competitor analysis endpoints"
 * )
 * @OA\Tag(
 *     name="Geographic",
 *     description="Geographic aggregation endpoints"
 * )
 * @OA\Tag(
 *     name="History",
 *     description="Historical data endpoints"
 * )
 * @OA\Tag(
 *     name="Status",
 *     description="API status and health endpoints"
 * )
 */
abstract class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;
}
