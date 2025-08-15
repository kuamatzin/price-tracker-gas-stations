<?php

namespace Database\Factories;

use App\Models\PriceChange;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PriceChange>
 */
class PriceChangeFactory extends Factory
{
    protected $model = PriceChange::class;
    
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $fuelType = $this->faker->randomElement(['regular', 'premium', 'diesel']);
        $subproductos = [
            'regular' => 'Gasolina Regular',
            'premium' => 'Gasolina Premium',
            'diesel' => 'Diésel'
        ];
        
        return [
            'station_numero' => $this->faker->numerify('#####'),
            'fuel_type' => $fuelType,
            'subproducto' => $subproductos[$fuelType],
            'price' => $this->faker->randomFloat(2, 20, 25),
            'changed_at' => now(),
            'detected_at' => now(),
        ];
    }
}
