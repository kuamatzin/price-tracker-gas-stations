<?php

namespace App\Helpers;

/**
 * Maps government SubProducto descriptions to normalized fuel types
 */
class FuelTypeMapper
{
    /**
     * Regular fuel patterns
     */
    private const REGULAR_PATTERNS = [
        'Regular (con un índice de octano ([RON+MON]/2) mínimo de 87)',
        'Regular (con contenido menor a 92 octanos)',
        'Regular',
        'Gasolina Regular',
    ];

    /**
     * Premium fuel patterns
     */
    private const PREMIUM_PATTERNS = [
        'Premium (con un índice de octano ([RON+MON]/2) mínimo de 91)',
        'Premium (con contenido mínimo de 92 octanos)',
        'Premium',
        'Gasolina Premium',
    ];

    /**
     * Diesel fuel patterns
     */
    private const DIESEL_PATTERNS = [
        'Diésel Automotriz',
        'Diésel',
        'Diesel',
    ];

    /**
     * Map SubProducto to normalized fuel type
     *
     * @param  string  $subproducto  The government API SubProducto field
     * @return string One of: 'regular', 'premium', 'diesel'
     *
     * @throws \InvalidArgumentException If fuel type cannot be determined
     */
    public static function mapToFuelType(string $subproducto): string
    {
        $normalized = trim($subproducto);

        // Check Regular patterns
        foreach (self::REGULAR_PATTERNS as $pattern) {
            if (stripos($normalized, $pattern) !== false ||
                stripos($normalized, 'regular') !== false &&
                stripos($normalized, 'octano') !== false &&
                stripos($normalized, '87') !== false) {
                return 'regular';
            }
        }

        // Check Premium patterns
        foreach (self::PREMIUM_PATTERNS as $pattern) {
            if (stripos($normalized, $pattern) !== false ||
                stripos($normalized, 'premium') !== false &&
                stripos($normalized, 'octano') !== false &&
                (stripos($normalized, '91') !== false || stripos($normalized, '92') !== false)) {
                return 'premium';
            }
        }

        // Check Diesel patterns
        foreach (self::DIESEL_PATTERNS as $pattern) {
            if (stripos($normalized, $pattern) !== false) {
                return 'diesel';
            }
        }

        // Additional checks for partial matches
        $lowerSubproducto = strtolower($normalized);

        if (str_contains($lowerSubproducto, 'diésel') || str_contains($lowerSubproducto, 'diesel')) {
            return 'diesel';
        }

        if (str_contains($lowerSubproducto, 'premium')) {
            return 'premium';
        }

        if (str_contains($lowerSubproducto, 'regular')) {
            return 'regular';
        }

        throw new \InvalidArgumentException("Unable to map SubProducto '{$subproducto}' to fuel type");
    }

    /**
     * Get all known SubProducto variations for a fuel type
     *
     * @param  string  $fuelType  One of: 'regular', 'premium', 'diesel'
     */
    public static function getKnownVariations(string $fuelType): array
    {
        return match ($fuelType) {
            'regular' => self::REGULAR_PATTERNS,
            'premium' => self::PREMIUM_PATTERNS,
            'diesel' => self::DIESEL_PATTERNS,
            default => throw new \InvalidArgumentException("Invalid fuel type: {$fuelType}")
        };
    }

    /**
     * Validate if a fuel type is valid
     */
    public static function isValidFuelType(string $fuelType): bool
    {
        return in_array($fuelType, ['regular', 'premium', 'diesel']);
    }
}
