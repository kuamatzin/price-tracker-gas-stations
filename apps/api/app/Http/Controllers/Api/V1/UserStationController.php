<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserStationController extends Controller
{
    /**
     * Get the authenticated user's stations.
     */
    public function index(): JsonResponse
    {
        $stations = Auth::user()->stations()->with(['municipio.entidad'])->get();
        
        return response()->json([
            'data' => $stations->map(function ($station) {
                return [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                    'direccion' => $station->direccion,
                    'municipio' => $station->municipio?->nombre,
                    'entidad' => $station->municipio?->entidad?->nombre,
                    'lat' => $station->lat,
                    'lng' => $station->lng,
                    'brand' => $station->brand,
                    'role' => $station->pivot->role,
                    'assigned_at' => $station->pivot->created_at,
                ];
            }),
        ]);
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
        
        $station = Station::with(['municipio.entidad'])->find($validated['station_numero']);
        
        return response()->json([
            'message' => 'Station assigned successfully',
            'data' => [
                'numero' => $station->numero,
                'nombre' => $station->nombre,
                'direccion' => $station->direccion,
                'municipio' => $station->municipio?->nombre,
                'entidad' => $station->municipio?->entidad?->nombre,
                'lat' => $station->lat,
                'lng' => $station->lng,
                'brand' => $station->brand,
                'role' => $role,
                'assigned_at' => now(),
            ],
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
    public function search(Request $request): JsonResponse
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
        
        return response()->json([
            'data' => $stations->map(function ($station) {
                return [
                    'numero' => $station->numero,
                    'nombre' => $station->nombre,
                    'direccion' => $station->direccion,
                    'municipio' => $station->municipio?->nombre,
                    'entidad' => $station->municipio?->entidad?->nombre,
                    'lat' => $station->lat,
                    'lng' => $station->lng,
                    'brand' => $station->brand,
                    'is_available' => true,
                ];
            }),
            'meta' => [
                'total' => $stations->total(),
                'per_page' => $stations->perPage(),
                'current_page' => $stations->currentPage(),
                'last_page' => $stations->lastPage(),
            ],
        ]);
    }
}