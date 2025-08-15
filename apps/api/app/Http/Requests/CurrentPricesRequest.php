<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CurrentPricesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'entidad' => 'nullable|exists:entidades,id',
            'municipio' => 'nullable|exists:municipios,id',
            'brand' => 'nullable|string|max:50',
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'fresh' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'entidad.exists' => 'La entidad especificada no existe',
            'municipio.exists' => 'El municipio especificado no existe',
            'brand.string' => 'La marca debe ser una cadena de texto',
            'brand.max' => 'La marca no puede exceder 50 caracteres',
            'page.integer' => 'La página debe ser un número entero',
            'page.min' => 'La página debe ser mayor a 0',
            'page_size.integer' => 'El tamaño de página debe ser un número entero',
            'page_size.min' => 'El tamaño de página debe ser mayor a 0',
            'page_size.max' => 'El tamaño de página no puede exceder 100',
            'fresh.boolean' => 'El parámetro fresh debe ser verdadero o falso',
        ];
    }
}