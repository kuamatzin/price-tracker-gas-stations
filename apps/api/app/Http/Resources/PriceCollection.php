<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class PriceCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection->transform(function ($item) {
                if (is_array($item)) {
                    // For nearby prices and station details
                    return new StationResource($item);
                } else {
                    // For current prices query results
                    return new PriceResource($item);
                }
            }),
        ];
    }

    public function with(Request $request): array
    {
        $meta = [];
        
        if ($this->resource instanceof \Illuminate\Pagination\LengthAwarePaginator) {
            $meta = [
                'current_page' => $this->resource->currentPage(),
                'per_page' => $this->resource->perPage(),
                'total' => $this->resource->total(),
                'last_page' => $this->resource->lastPage(),
                'from' => $this->resource->firstItem(),
                'to' => $this->resource->lastItem(),
            ];
            
            $links = [
                'first' => $this->resource->url(1),
                'last' => $this->resource->url($this->resource->lastPage()),
                'next' => $this->resource->nextPageUrl(),
                'prev' => $this->resource->previousPageUrl(),
            ];
            
            return compact('meta', 'links');
        }
        
        return [];
    }
}