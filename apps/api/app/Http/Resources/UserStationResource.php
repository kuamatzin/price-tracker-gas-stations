<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserStationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = [
            'numero' => $this->numero,
            'nombre' => $this->nombre,
            'direccion' => $this->direccion,
            'brand' => $this->brand,
            'location' => [
                'lat' => (float) $this->lat,
                'lng' => (float) $this->lng,
                'municipio' => $this->whenLoaded('municipio', function () {
                    return [
                        'id' => $this->municipio->id,
                        'nombre' => $this->municipio->nombre,
                        'entidad' => $this->municipio->relationLoaded('entidad') ? [
                            'id' => $this->municipio->entidad->id,
                            'nombre' => $this->municipio->entidad->nombre,
                        ] : null,
                    ];
                }),
            ],
            'user_role' => $this->whenPivotLoaded('user_stations', function () {
                return $this->pivot->role;
            }),
            'assigned_at' => $this->whenPivotLoaded('user_stations', function () {
                return $this->pivot->created_at;
            }),
            'is_active' => $this->is_active,
        ];
        
        if ($request->input('include_stats')) {
            $data['stats'] = [
                'total_price_changes' => $this->price_changes_count ?? 0,
                'last_price_update' => $this->latest_price_change?->changed_at ?? null,
            ];
        }
        
        return $data;
    }
}