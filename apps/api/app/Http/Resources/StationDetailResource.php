<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StationDetailResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
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
                    ];
                }),
                'entidad' => $this->whenLoaded('municipio', function () {
                    return [
                        'id' => $this->municipio->entidad?->id,
                        'nombre' => $this->municipio->entidad?->nombre,
                    ];
                }),
            ],
            'is_active' => $this->is_active,
            'current_prices' => $this->whenLoaded('latestPrices', function () {
                return $this->latestPrices->map(function ($price) {
                    return [
                        'fuel_type' => $price->fuel_type,
                        'price' => (float) $price->price,
                        'previous_price' => (float) $price->previous_price,
                        'change_amount' => (float) $price->change_amount,
                        'change_percentage' => (float) $price->change_percentage,
                        'updated_at' => $price->changed_at,
                    ];
                });
            }),
            'statistics' => $this->when($request->input('include_stats'), function () {
                return [
                    'total_users' => $this->users_count ?? 0,
                    'price_changes_today' => $this->price_changes_today_count ?? 0,
                    'price_changes_week' => $this->price_changes_week_count ?? 0,
                    'price_changes_month' => $this->price_changes_month_count ?? 0,
                    'average_price_regular' => $this->average_price_regular ?? null,
                    'average_price_premium' => $this->average_price_premium ?? null,
                    'average_price_diesel' => $this->average_price_diesel ?? null,
                ];
            }),
            'competitors' => $this->whenLoaded('competitors', function () {
                return $this->competitors->map(function ($competitor) {
                    return [
                        'numero' => $competitor->numero,
                        'nombre' => $competitor->nombre,
                        'brand' => $competitor->brand,
                        'distance_km' => round($competitor->distance, 2),
                    ];
                });
            }),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}