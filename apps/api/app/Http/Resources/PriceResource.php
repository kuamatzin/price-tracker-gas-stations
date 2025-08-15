<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PriceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'station' => [
                'numero' => $this->numero,
                'nombre' => $this->nombre,
                'direccion' => $this->direccion,
                'lat' => (float) $this->lat,
                'lng' => (float) $this->lng,
                'brand' => $this->brand,
                'municipio' => $this->municipio_nombre,
                'entidad' => $this->entidad_nombre,
            ],
            'price' => [
                'fuel_type' => $this->fuel_type,
                'price' => (float) $this->price,
                'changed_at' => $this->changed_at,
                'trend' => $this->trend,
            ],
            'last_updated' => $this->changed_at,
        ];
    }
}