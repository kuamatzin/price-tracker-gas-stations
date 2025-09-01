<?php

namespace Tests\Unit\Services\Telegram;

use App\Services\External\DeepSeekService;
use App\Services\Telegram\NlpProcessor;
use Mockery;
use Tests\TestCase;

class NlpProcessorTest extends TestCase
{
    protected NlpProcessor $processor;

    protected $mockDeepSeek;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mockDeepSeek = Mockery::mock(DeepSeekService::class);
        $this->processor = new NlpProcessor($this->mockDeepSeek);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_extracts_price_query_intent()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $queries = [
            '¿Cuánto está la gasolina?' => 'price_query',
            'precio de diesel' => 'price_query',
            '¿a cómo está la premium?' => 'price_query',
            'cuánto cuesta la magna' => 'price_query',
            '¿qué tal está el precio?' => 'price_query',
        ];

        foreach ($queries as $query => $expectedIntent) {
            $result = $this->processor->process($query);

            $this->assertEquals($expectedIntent, $result['intent']);
            $this->assertGreaterThanOrEqual(0.5, $result['confidence']);
        }
    }

    public function test_extracts_station_search_intent()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $queries = [
            '¿dónde está la gasolinera más cercana?' => 'station_search',
            'buscar estación pemex' => 'station_search',
            'gasolineras cerca de aquí' => 'station_search',
        ];

        foreach ($queries as $query => $expectedIntent) {
            $result = $this->processor->process($query);

            $this->assertEquals($expectedIntent, $result['intent']);
        }
    }

    public function test_corrects_common_typos()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $result = $this->processor->process('presio de gsolina');

        $this->assertStringContainsString('precio', $result['normalized_query']);
        $this->assertStringContainsString('gasolina', $result['normalized_query']);
    }

    public function test_maps_colloquialisms_to_standard_terms()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $colloquialisms = [
            'gasolina verde' => 'regular',
            'la magna' => 'regular',
            'gasolina roja' => 'premium',
            'gasofa' => 'diesel',
        ];

        foreach ($colloquialisms as $colloquial => $standard) {
            $result = $this->processor->process("precio de $colloquial");

            $this->assertEquals($standard, $result['entities']['fuel_type']);
        }
    }

    public function test_extracts_fuel_type_entity()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $fuelTypes = [
            'premium' => 'premium',
            'magna' => 'regular',
            'regular' => 'regular',
            'diesel' => 'diesel',
            'diésel' => 'diesel',
        ];

        foreach ($fuelTypes as $input => $expected) {
            $result = $this->processor->process("precio de $input");

            $this->assertEquals($expected, $result['entities']['fuel_type']);
        }
    }

    public function test_extracts_time_period_entity()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $timePeriods = [
            '7 días' => 7,
            '2 semanas' => 14,
            '1 mes' => 30,
            '3 días' => 3,
        ];

        foreach ($timePeriods as $input => $expected) {
            $result = $this->processor->process("tendencia de $input");

            $this->assertEquals($expected, $result['entities']['time_period']);
        }
    }

    public function test_detects_follow_up_queries()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        $followUps = [
            '¿y la premium?' => true,
            'también la diesel' => true,
            '¿y de ayer?' => true,
            'precio de gasolina' => false,
        ];

        foreach ($followUps as $query => $isFollowUp) {
            $result = $this->processor->isFollowUpQuery($query);

            $this->assertEquals($isFollowUp, $result);
        }
    }

    public function test_merges_context_correctly()
    {
        $currentContext = [
            'fuel_type' => 'regular',
            'location' => 'centro',
            'entities' => ['fuel_type' => 'regular'],
        ];

        $newData = [
            'intent' => 'price_query',
            'entities' => ['time_period' => 7],
        ];

        $merged = $this->processor->mergeContext($currentContext, $newData);

        $this->assertEquals('regular', $merged['fuel_type']);
        $this->assertEquals('centro', $merged['location']);
        $this->assertEquals('price_query', $merged['intent']);
        $this->assertEquals('regular', $merged['entities']['fuel_type']);
        $this->assertEquals(7, $merged['entities']['time_period']);
        $this->assertEquals(1, $merged['conversation_turn']);
    }

    public function test_uses_deepseek_when_confidence_low()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(true);
        $this->mockDeepSeek->shouldReceive('analyze')
            ->once()
            ->andReturn([
                'intent' => 'price_query',
                'entities' => ['fuel_type' => 'premium'],
                'confidence' => 0.9,
                'suggested_command' => '/precio premium',
                'response_time_ms' => 150,
            ]);

        $result = $this->processor->process('quiero saber algo sobre combustible');

        $this->assertTrue($result['used_deepseek']);
        $this->assertEquals('price_query', $result['intent']);
        $this->assertEquals(0.9, $result['confidence']);
    }

    public function test_handles_deepseek_failure_gracefully()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(true);
        $this->mockDeepSeek->shouldReceive('analyze')
            ->once()
            ->andThrow(new \Exception('DeepSeek API error'));

        $result = $this->processor->process('texto ambiguo');

        $this->assertFalse($result['used_deepseek']);
        $this->assertNotNull($result['intent']);
    }

    public function test_suggests_appropriate_commands()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        // Test price query suggestion
        $result1 = $this->processor->process('precio de premium');
        $this->assertEquals('/precio premium', $result1['suggested_command']);

        // Test station search suggestion
        $result2 = $this->processor->process('estaciones cercanas');
        $this->assertEquals('/cercanas', $result2['suggested_command']);

        // Test help suggestion
        $result3 = $this->processor->process('necesito ayuda');
        $this->assertEquals('/ayuda', $result3['suggested_command']);
    }

    public function test_calculates_confidence_based_on_intent_and_entities()
    {
        $this->mockDeepSeek->shouldReceive('isAvailable')->andReturn(false);

        // High confidence: clear intent + relevant entities
        $result1 = $this->processor->process('precio de premium');
        $this->assertGreaterThanOrEqual(0.7, $result1['confidence']);

        // Medium confidence: clear intent, no entities
        $result2 = $this->processor->process('¿cuánto cuesta?');
        $this->assertGreaterThan(0.5, $result2['confidence']);
        $this->assertLessThan(0.9, $result2['confidence']);

        // Low confidence: unclear intent
        $result3 = $this->processor->process('hola');
        $this->assertLessThan(0.7, $result3['confidence']);
    }
}
