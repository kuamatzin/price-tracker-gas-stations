<?php

namespace Database\Factories;

use App\Models\AlertConfiguration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AlertConfiguration>
 */
class AlertConfigurationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = AlertConfiguration::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => $this->faker->sentence(3),
            'type' => $this->faker->randomElement(['price_change', 'competitor_move', 'market_trend']),
            'conditions' => [
                'threshold_percentage' => $this->faker->randomFloat(1, 1, 10),
                'threshold_type' => 'percentage',
                'fuel_types' => ['regular', 'premium', 'diesel'],
                'radius_km' => $this->faker->numberBetween(1, 20),
                'stations' => [],
            ],
            'is_active' => true,
            'last_triggered_at' => $this->faker->optional(0.3)->dateTimeThisMonth(),
        ];
    }

    /**
     * Indicate that the alert is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Indicate that the alert is for specific stations.
     */
    public function forStations(array $stationNumeros): static
    {
        return $this->state(fn (array $attributes) => [
            'conditions' => array_merge($attributes['conditions'] ?? [], [
                'stations' => $stationNumeros,
            ]),
        ]);
    }

    /**
     * Indicate that the alert was recently triggered.
     */
    public function recentlyTriggered(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_triggered_at' => now()->subMinutes(30),
        ]);
    }
}