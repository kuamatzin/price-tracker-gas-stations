<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class UserStationCollection extends ResourceCollection
{
    /**
     * The resource that this resource collects.
     *
     * @var string
     */
    public $collects = UserStationResource::class;

    /**
     * Transform the resource collection into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            'meta' => [
                'total' => $this->collection->count(),
                'has_owner_role' => $this->collection->contains(function ($station) {
                    return $station->pivot && $station->pivot->role === 'owner';
                }),
                'default_station_numero' => $this->collection->first()?->numero,
            ],
        ];
    }
    
    /**
     * Get additional data that should be returned with the resource array.
     *
     * @return array<string, mixed>
     */
    public function with(Request $request): array
    {
        return [
            'links' => [
                'self' => route('api.v1.user.stations.index'),
                'assign' => route('api.v1.user.stations.store'),
            ],
        ];
    }
}