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
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'radius' => 'nullable|numeric|min:0.5|max:50',
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'fresh' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'lat.required' => 'La latitud es requerida',
            'lat.numeric' => 'La latitud debe ser un número',
            'lat.between' => 'La latitud debe estar entre -90 y 90',
            'lng.required' => 'La longitud es requerida',
            'lng.numeric' => 'La longitud debe ser un número',
            'lng.between' => 'La longitud debe estar entre -180 y 180',
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