<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'station' => [
                'numero' => $this->resource['station']->numero,
                'nombre' => $this->resource['station']->nombre,
                'direccion' => $this->resource['station']->direccion,
                'lat' => (float) $this->resource['station']->lat,
                'lng' => (float) $this->resource['station']->lng,
                'brand' => $this->resource['station']->brand,
                'municipio' => $this->resource['station']->municipio_nombre ?? null,
                'entidad' => $this->resource['station']->entidad_nombre ?? null,
            ],
            'prices' => $this->formatPrices($this->resource['prices']),
            'last_updated' => $this->resource['last_updated'],
        ];

        if (isset($this->resource['station']->distance_km)) {
            $data['distance_km'] = (float) $this->resource['station']->distance_km;
        }

        return $data;
    }

    private function formatPrices($prices): array
    {
        $formatted = [];
        
        foreach ($prices as $price) {
            $formatted[$price->fuel_type] = [
                'price' => (float) $price->price,
                'changed_at' => $price->changed_at,
                'trend' => $price->trend,
                'change_percent' => (float) ($price->change_percent ?? 0),
            ];
        }
        
        return $formatted;
    }
}