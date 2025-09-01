<?php

namespace Database\Factories;

use App\Models\Entidad;
use Illuminate\Database\Eloquent\Factories\Factory;

class EntidadFactory extends Factory
{
    protected $model = Entidad::class;

    public function definition(): array
    {
        $estados = [
            'CDMX', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato',
            'Chiapas', 'Veracruz', 'Oaxaca', 'Chihuahua', 'Guerrero',
        ];

        $nombre = $this->faker->randomElement($estados);

        return [
            'id' => $this->faker->unique()->numberBetween(1, 32),
            'nombre' => $nombre,
            'codigo' => strtoupper(substr($nombre, 0, 3)),
        ];
    }
}
