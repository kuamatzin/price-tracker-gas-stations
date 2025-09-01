<?php

namespace Database\Factories;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Station>
 */
class StationFactory extends Factory
{
    protected $model = Station::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'numero' => $this->faker->unique()->numerify('#####'),
            'nombre' => $this->faker->company(),
            'direccion' => $this->faker->streetAddress(),
            'lat' => $this->faker->latitude(18, 20),
            'lng' => $this->faker->longitude(-100, -98),
            'entidad_id' => Entidad::factory(),
            'municipio_id' => Municipio::factory(),
            'brand' => $this->faker->randomElement(['Pemex', 'Shell', 'BP', 'Chevron', 'Mobil']),
            'is_active' => true,
        ];
    }
}
