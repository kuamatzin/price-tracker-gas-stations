<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\StationSearchResource;
use App\Http\Resources\UserStationCollection;
use App\Http\Resources\UserStationResource;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserStationController extends Controller
{
    /**
     * Get the authenticated user's stations.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Auth::user()->stations()->with(['municipio.entidad']);
        
        // Optionally include statistics
        if ($request->boolean('include_stats')) {
            $query->withCount('priceChanges')
                  ->with('latestPriceChange');
        }
        
        $stations = $query->get();
        
        return (new UserStationCollection($stations))
            ->response()
            ->setStatusCode(200);
    }
    
    /**
     * Assign a station to the authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'station_numero' => [
                'required',
                'string',
                'exists:stations,numero',
                function ($attribute, $value, $fail) {
                    if (Auth::user()->stations()->where('station_numero', $value)->exists()) {
                        $fail('This station is already assigned to you.');
                    }
                },
            ],
            'role' => 'nullable|in:owner,manager,viewer',
        ]);
        
        $role = $validated['role'] ?? 'viewer';
        
        Auth::user()->stations()->attach($validated['station_numero'], [
            'role' => $role,
        ]);
        
        // Reload the station with the pivot data from the relationship
        $station = Auth::user()->stations()
            ->with(['municipio.entidad'])
            ->where('station_numero', $validated['station_numero'])
            ->first();
        
        return response()->json([
            'message' => 'Station assigned successfully',
            'data' => new UserStationResource($station),
        ], 201);
    }
    
    /**
     * Remove a station assignment from the authenticated user.
     */
    public function destroy(string $numero): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user->stations()->where('station_numero', $numero)->exists()) {
            return response()->json([
                'message' => 'Station not found or not assigned to you',
            ], 404);
        }
        
        $user->stations()->detach($numero);
        
        return response()->json([
            'message' => 'Station unassigned successfully',
        ]);
    }
    
    /**
     * Search available stations to assign.
     */
    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => 'nullable|string|min:2',
            'entidad_id' => 'nullable|integer|exists:entidades,id',
            'municipio_id' => 'nullable|integer|exists:municipios,id',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        
        $query = Station::with(['municipio.entidad'])
            ->where('is_active', true);
        
        // Search by numero or nombre
        if (!empty($validated['q'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('numero', 'LIKE', '%' . $validated['q'] . '%')
                  ->orWhere('nombre', 'LIKE', '%' . $validated['q'] . '%');
            });
        }
        
        // Filter by entidad
        if (!empty($validated['entidad_id'])) {
            $query->where('entidad_id', $validated['entidad_id']);
        }
        
        // Filter by municipio
        if (!empty($validated['municipio_id'])) {
            $query->where('municipio_id', $validated['municipio_id']);
        }
        
        // Exclude stations already assigned to user
        $userStationNumeros = Auth::user()->stations()->pluck('station_numero');
        $query->whereNotIn('numero', $userStationNumeros);
        
        $perPage = $validated['per_page'] ?? 20;
        $stations = $query->paginate($perPage);
        
        return StationSearchResource::collection($stations)
            ->additional([
                'meta' => [
                    'available_count' => $stations->total(),
                    'filters_applied' => array_filter([
                        'search' => $validated['q'] ?? null,
                        'entidad_id' => $validated['entidad_id'] ?? null,
                        'municipio_id' => $validated['municipio_id'] ?? null,
                    ]),
                ],
            ]);
    }
}