<?php

namespace Tests\Unit\Services\Telegram;

use App\Services\Telegram\SparklineGenerator;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SparklineGeneratorTest extends TestCase
{
    private SparklineGenerator $generator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->generator = new SparklineGenerator;
    }

    public function test_create_sparkline_with_valid_data()
    {
        $values = [20.0, 21.0, 22.5, 21.5, 23.0, 22.0];

        $result = $this->generator->generate($values);

        $this->assertIsString($result);
        $this->assertStringContainsString('▁', $result); // Should contain sparkline characters
        $this->assertMatchesRegularExpression('/[▁▂▃▄▅▆▇█]+/', $result);
    }

    public function test_handle_empty_values()
    {
        $values = [];

        $result = $this->generator->generate($values);

        $this->assertEquals('', $result);
    }

    public function test_handle_single_value()
    {
        $values = [22.5];

        $result = $this->generator->generate($values);

        $this->assertIsString($result);
        $this->assertStringContainsString('▄', $result); // Middle character for single value
    }

    public function test_handle_infinite_and_nan_values()
    {
        $values = [20.0, INF, 22.0, NAN, 23.0, -INF, 24.0];

        // The validateValues method should filter these out
        $result = $this->generator->generate($values);

        $this->assertIsString($result);
        // Should only process valid numeric values: [20.0, 22.0, 23.0, 24.0]
        $this->assertStringNotContainsString('NAN', $result);
        $this->assertStringNotContainsString('INF', $result);
    }

    public function test_trend_indicator_up()
    {
        $values = [20.0, 21.0, 22.0, 23.0, 24.0];

        $result = $this->generator->generate($values, '', true, false);

        $this->assertStringContainsString('↑', $result);
    }

    public function test_trend_indicator_down()
    {
        $values = [24.0, 23.0, 22.0, 21.0, 20.0];

        $result = $this->generator->generate($values, '', true, false);

        $this->assertStringContainsString('↓', $result);
    }

    public function test_trend_indicator_stable()
    {
        $values = [22.0, 22.1, 22.0, 22.05, 22.02];

        $result = $this->generator->generate($values, '', true, false);

        $this->assertStringContainsString('→', $result);
    }

    public function test_generate_with_label()
    {
        $values = [20.0, 21.0, 22.0];
        $label = 'Regular';

        $result = $this->generator->generate($values, $label);

        $this->assertStringContainsString('Regular:', $result);
    }

    public function test_generate_with_change_text()
    {
        $values = [20.0, 21.0, 22.0];

        $result = $this->generator->generate($values, '', false, true);

        $this->assertStringContainsString('+10.0%', $result); // (22-20)/20 * 100
        $this->assertStringContainsString('$20.00 → $22.00', $result);
    }

    public function test_generate_multiple_series()
    {
        $series = [
            'regular' => [20.0, 21.0, 22.0],
            'premium' => [23.0, 23.5, 24.0],
            'diesel' => [21.0, 21.2, 21.5],
        ];

        $result = $this->generator->generateMultiple($series);

        $this->assertIsArray($result);
        $this->assertCount(3, $result);
        $this->assertArrayHasKey('regular', $result);
        $this->assertArrayHasKey('premium', $result);
        $this->assertArrayHasKey('diesel', $result);
    }

    public function test_format_for_table()
    {
        $series = [
            'regular' => [20.0, 21.0, 22.0],
            'premium' => [23.0, 22.5, 22.0],
        ];

        $result = $this->generator->formatForTable($series);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertStringContainsString('Regular', $result[0]);
        $this->assertStringContainsString('Premium', $result[1]);
        $this->assertStringContainsString('+10.0%', $result[0]); // Regular increased
        $this->assertStringContainsString('-4.3%', $result[1]); // Premium decreased
    }

    public function test_mini_sparkline_with_sampling()
    {
        $values = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

        $result = $this->generator->mini($values, 5);

        $this->assertIsString($result);
        $this->assertLessThanOrEqual(5, strlen($result));
    }

    public function test_generate_comparison()
    {
        $yourValues = [20.0, 21.0, 22.0];
        $competitorValues = [21.0, 21.5, 21.8];

        $result = $this->generator->generateComparison(
            $yourValues,
            $competitorValues,
            'Tu estación',
            'Promedio'
        );

        $this->assertIsArray($result);
        $this->assertArrayHasKey('Tu estación', $result);
        $this->assertArrayHasKey('Promedio', $result);
        $this->assertArrayHasKey('difference', $result);
        $this->assertStringContainsString('Diferencia:', $result['difference']);
    }

    public function test_all_same_values_creates_flat_line()
    {
        $values = [22.0, 22.0, 22.0, 22.0, 22.0];

        $reflection = new \ReflectionClass($this->generator);
        $method = $reflection->getMethod('createSparkline');
        $method->setAccessible(true);

        $result = $method->invoke($this->generator, $values);

        // Should return middle character repeated
        $this->assertEquals(str_repeat('▄', 5), $result);
    }

    public function test_caching_works()
    {
        $values = [20.0, 21.0, 22.0];
        $label = 'Test';

        Cache::shouldReceive('remember')
            ->once()
            ->andReturn('Test: ▁▄█ ↑ +10.0%');

        $result = $this->generator->generate($values, $label);

        $this->assertEquals('Test: ▁▄█ ↑ +10.0%', $result);
    }

    public function test_difference_chart_generation()
    {
        $series1 = [22.0, 23.0, 24.0];
        $series2 = [21.0, 22.5, 23.5];

        $reflection = new \ReflectionClass($this->generator);
        $method = $reflection->getMethod('generateDifferenceChart');
        $method->setAccessible(true);

        $result = $method->invoke($this->generator, $series1, $series2);

        $this->assertStringContainsString('Diferencia:', $result);
        $this->assertStringContainsString('▲', $result); // series1 > series2
    }

    public function test_validate_values_filters_invalid()
    {
        $reflection = new \ReflectionClass($this->generator);
        $method = $reflection->getMethod('validateValues');
        $method->setAccessible(true);

        $input = [20.0, 'invalid', null, 22.0, NAN, 23.0, INF, 24.0, -INF];
        $result = $method->invoke($this->generator, $input);

        $this->assertEquals([20.0, 22.0, 23.0, 24.0], $result);
    }
}
