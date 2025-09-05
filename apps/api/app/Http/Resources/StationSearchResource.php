<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StationSearchResource extends JsonResource
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
                    return $this->municipio->nombre;
                }),
                'entidad' => $this->whenLoaded('municipio', function () {
                    return $this->municipio->entidad?->nombre;
                }),
            ],
            'is_available' => true,
        ];
        
        if (isset($this->distance)) {
            $data['distance_km'] = round($this->distance, 2);
        }
        
        return $data;
    }
}