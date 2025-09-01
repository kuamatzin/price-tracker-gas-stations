<?php

namespace App\Contracts;

/**
 * Interface for Analytics Service
 *
 * Defines the contract for analytics operations including trend analysis,
 * competitor ranking, and price history tracking.
 */
interface AnalyticsServiceInterface
{
    /**
     * Get price trends for a station area over specified days
     *
     * @param  string  $stationNumero  Station identifier
     * @param  int  $days  Number of days to analyze
     * @param  float|null  $radiusKm  Search radius in kilometers
     * @return array Trend analysis data
     */
    public function getPriceTrends(
        string $stationNumero,
        int $days = 7,
        ?float $radiusKm = null
    ): array;

    /**
     * Get competitor ranking for a station
     *
     * @param  string  $stationNumero  Station identifier
     * @param  float|null  $radiusKm  Search radius in kilometers
     * @return array Ranking data with recommendations
     */
    public function getCompetitorRanking(
        string $stationNumero,
        ?float $radiusKm = null
    ): array;

    /**
     * Get price history with analysis
     *
     * @param  string  $stationNumero  Station identifier
     * @param  int  $days  Number of days to retrieve
     * @param  string|null  $fuelType  Specific fuel type or null for all
     * @return array Historical price data with statistics
     */
    public function getPriceHistory(
        string $stationNumero,
        int $days = 7,
        ?string $fuelType = null
    ): array;
}
