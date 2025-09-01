<?php

namespace Tests\Unit;

use App\Helpers\FuelTypeMapper;
use PHPUnit\Framework\TestCase;

class FuelTypeMapperTest extends TestCase
{
    /**
     * Test mapping regular fuel variations
     */
    public function test_maps_regular_fuel_correctly(): void
    {
        $regularVariations = [
            'Regular (con un índice de octano ([RON+MON]/2) mínimo de 87)',
            'Regular (con contenido menor a 92 octanos)',
            'Regular',
            'Gasolina Regular',
            'REGULAR',
            ' Regular ',
        ];

        foreach ($regularVariations as $variation) {
            $this->assertEquals(
                'regular',
                FuelTypeMapper::mapToFuelType($variation),
                "Failed to map '{$variation}' to 'regular'"
            );
        }
    }

    /**
     * Test mapping premium fuel variations
     */
    public function test_maps_premium_fuel_correctly(): void
    {
        $premiumVariations = [
            'Premium (con un índice de octano ([RON+MON]/2) mínimo de 91)',
            'Premium (con contenido mínimo de 92 octanos)',
            'Premium',
            'Gasolina Premium',
            'PREMIUM',
            ' Premium ',
        ];

        foreach ($premiumVariations as $variation) {
            $this->assertEquals(
                'premium',
                FuelTypeMapper::mapToFuelType($variation),
                "Failed to map '{$variation}' to 'premium'"
            );
        }
    }

    /**
     * Test mapping diesel fuel variations
     */
    public function test_maps_diesel_fuel_correctly(): void
    {
        $dieselVariations = [
            'Diésel Automotriz [contenido mayor de azufre entre 15 a 500 ppm]',
            'Diésel',
            'Diesel',
            'DIESEL',
            'Diésel Automotriz',
            ' Diésel ',
        ];

        foreach ($dieselVariations as $variation) {
            $this->assertEquals(
                'diesel',
                FuelTypeMapper::mapToFuelType($variation),
                "Failed to map '{$variation}' to 'diesel'"
            );
        }
    }

    /**
     * Test that unknown fuel types throw exception
     */
    public function test_throws_exception_for_unknown_fuel_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage("Unable to map SubProducto 'Unknown Fuel Type' to fuel type");

        FuelTypeMapper::mapToFuelType('Unknown Fuel Type');
    }

    /**
     * Test getting known variations
     */
    public function test_get_known_variations(): void
    {
        $regularVariations = FuelTypeMapper::getKnownVariations('regular');
        $this->assertIsArray($regularVariations);
        $this->assertNotEmpty($regularVariations);

        $premiumVariations = FuelTypeMapper::getKnownVariations('premium');
        $this->assertIsArray($premiumVariations);
        $this->assertNotEmpty($premiumVariations);

        $dieselVariations = FuelTypeMapper::getKnownVariations('diesel');
        $this->assertIsArray($dieselVariations);
        $this->assertNotEmpty($dieselVariations);
    }

    /**
     * Test invalid fuel type for getKnownVariations
     */
    public function test_get_known_variations_throws_for_invalid_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid fuel type: invalid');

        FuelTypeMapper::getKnownVariations('invalid');
    }

    /**
     * Test fuel type validation
     */
    public function test_validates_fuel_types(): void
    {
        $this->assertTrue(FuelTypeMapper::isValidFuelType('regular'));
        $this->assertTrue(FuelTypeMapper::isValidFuelType('premium'));
        $this->assertTrue(FuelTypeMapper::isValidFuelType('diesel'));

        $this->assertFalse(FuelTypeMapper::isValidFuelType('invalid'));
        $this->assertFalse(FuelTypeMapper::isValidFuelType(''));
        $this->assertFalse(FuelTypeMapper::isValidFuelType('REGULAR'));
    }

    /**
     * Test case insensitive matching
     */
    public function test_case_insensitive_matching(): void
    {
        $this->assertEquals('regular', FuelTypeMapper::mapToFuelType('REGULAR'));
        $this->assertEquals('premium', FuelTypeMapper::mapToFuelType('PREMIUM'));
        $this->assertEquals('diesel', FuelTypeMapper::mapToFuelType('DIESEL'));
        $this->assertEquals('diesel', FuelTypeMapper::mapToFuelType('diésel'));
    }

    /**
     * Test whitespace handling
     */
    public function test_handles_whitespace(): void
    {
        $this->assertEquals('regular', FuelTypeMapper::mapToFuelType('  Regular  '));
        $this->assertEquals('premium', FuelTypeMapper::mapToFuelType("\nPremium\t"));
        $this->assertEquals('diesel', FuelTypeMapper::mapToFuelType(' Diésel '));
    }
}
