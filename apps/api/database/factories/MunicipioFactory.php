<?php

namespace Database\Factories;

use App\Models\Municipio;
use App\Models\Entidad;
use Illuminate\Database\Eloquent\Factories\Factory;

class MunicipioFactory extends Factory
{
    protected $model = Municipio::class;

    public function definition(): array
    {
        $municipios = [
            'Cuauhtémoc', 'Benito Juárez', 'Miguel Hidalgo', 'Coyoacán',
            'Tlalpan', 'Xochimilco', 'Azcapotzalco', 'Iztapalapa',
            'Gustavo A. Madero', 'Álvaro Obregón'
        ];
        
        return [
            'id' => $this->faker->unique()->numberBetween(1, 2500),
            'entidad_id' => Entidad::factory(),
            'nombre' => $this->faker->randomElement($municipios)
        ];
    }
}