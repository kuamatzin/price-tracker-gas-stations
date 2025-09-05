<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class NearbyPricesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'station_numero' => 'required|string|exists:stations,numero',
            'radius' => 'nullable|numeric|min:0.5|max:50',
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'fresh' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'station_numero.required' => 'El número de estación es requerido',
            'station_numero.exists' => 'La estación especificada no existe',
            'radius.numeric' => 'El radio debe ser un número',
            'radius.min' => 'El radio mínimo es 0.5km',
            'radius.max' => 'El radio máximo es 50km',
            'page.integer' => 'La página debe ser un número entero',
            'page.min' => 'La página debe ser mayor a 0',
            'page_size.integer' => 'El tamaño de página debe ser un número entero',
            'page_size.min' => 'El tamaño de página debe ser mayor a 0',
            'page_size.max' => 'El tamaño de página no puede exceder 100',
            'fresh.boolean' => 'El parámetro fresh debe ser verdadero o falso',
        ];
    }
}
