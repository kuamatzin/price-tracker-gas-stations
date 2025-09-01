<?php

namespace App\Services\Telegram;

use Illuminate\Support\Collection;

class TableFormatter
{
    /**
     * Format station prices as a detailed table
     */
    public function formatStationPrices($station, Collection $prices, Collection $priceHistory): string
    {
        // Validate inputs
        if (! $station || ! isset($station->alias) || ! isset($station->nombre)) {
            return '❌ Error: Datos de estación inválidos';
        }

        if ($prices->isEmpty()) {
            return "❌ No hay precios disponibles para {$station->alias}";
        }

        $response = "💰 **Precios Actuales - {$station->alias}**\n";
        $response .= "📍 {$station->nombre}\n";
        $response .= "📌 {$station->direccion}\n\n";

        $response .= "```\n";
        $response .= "Tipo     Precio   Cambio\n";
        $response .= "-------- -------- -------\n";

        foreach ($prices as $priceData) {
            $fuelType = ucfirst($priceData->fuel_type);
            $price = sprintf('$%.2f', $priceData->price);

            // Calculate change indicator
            $indicator = $this->getPriceChangeIndicator($priceData, $priceHistory);

            $response .= sprintf(
                "%-8s %-8s %s\n",
                $fuelType,
                $price,
                $indicator['display']
            );
        }

        $response .= "```\n";
        $response .= "\n_Última actualización: ".$this->getTimeAgo($prices->first()->detected_at ?? now()).'_';

        return $response;
    }

    /**
     * Format compact station prices for multiple stations view
     */
    public function formatCompactStationPrices($station, Collection $prices, Collection $priceHistory): string
    {
        $response = "📍 **{$station->alias}** - {$station->nombre}\n";

        $priceStrings = [];
        foreach ($prices as $priceData) {
            $indicator = $this->getPriceChangeIndicator($priceData, $priceHistory);
            $priceStrings[] = sprintf(
                '%s: $%.2f %s',
                ucfirst($priceData->fuel_type),
                $priceData->price,
                $indicator['emoji']
            );
        }

        $response .= implode(' | ', $priceStrings)."\n";

        return $response;
    }

    /**
     * Format prices as a markdown table
     */
    public function formatPriceTable(Collection $prices): string
    {
        $table = "| Tipo | Precio | Cambio |\n";
        $table .= "|------|--------|--------|\n";

        foreach ($prices as $price) {
            $table .= sprintf(
                "| %s | $%.2f | %s |\n",
                ucfirst($price->fuel_type),
                $price->price,
                $price->change_indicator ?? '➡️'
            );
        }

        return $table;
    }

    /**
     * Calculate price change indicator
     */
    private function getPriceChangeIndicator($currentPrice, Collection $priceHistory): array
    {
        // Find previous price for this fuel type
        $previousPrices = $priceHistory
            ->where('fuel_type', $currentPrice->fuel_type)
            ->sortByDesc('changed_at')
            ->values();

        // Skip the current price and get the previous one
        $previousPrice = null;
        foreach ($previousPrices as $price) {
            if ($price->id !== $currentPrice->id) {
                $previousPrice = $price;
                break;
            }
        }

        if (! $previousPrice) {
            return [
                'emoji' => '➡️',
                'display' => '➡️ 0%',
                'percent' => 0,
            ];
        }

        $change = $currentPrice->price - $previousPrice->price;
        $changePercent = ($change / $previousPrice->price) * 100;

        if ($change > 0.01) {
            return [
                'emoji' => '📈',
                'display' => sprintf('📈 +%.1f%%', abs($changePercent)),
                'percent' => $changePercent,
            ];
        } elseif ($change < -0.01) {
            return [
                'emoji' => '📉',
                'display' => sprintf('📉 %.1f%%', $changePercent),
                'percent' => $changePercent,
            ];
        } else {
            return [
                'emoji' => '➡️',
                'display' => '➡️ 0%',
                'percent' => 0,
            ];
        }
    }

    /**
     * Convert timestamp to relative time
     */
    private function getTimeAgo($timestamp): string
    {
        if (! $timestamp) {
            return 'Fecha desconocida';
        }

        $now = now();
        $time = is_string($timestamp) ? \Carbon\Carbon::parse($timestamp) : $timestamp;

        $diff = $now->diffInMinutes($time);

        if ($diff < 1) {
            return 'hace menos de 1 minuto';
        } elseif ($diff < 60) {
            return "hace {$diff} minutos";
        } elseif ($diff < 1440) {
            $hours = floor($diff / 60);

            return "hace {$hours} ".($hours == 1 ? 'hora' : 'horas');
        } else {
            $days = floor($diff / 1440);

            return "hace {$days} ".($days == 1 ? 'día' : 'días');
        }
    }

    /**
     * Format currency with peso symbol
     */
    public function formatCurrency(float $amount): string
    {
        return sprintf('$%.2f', $amount);
    }

    /**
     * Create a simple text table
     */
    public function createTextTable(array $headers, array $rows): string
    {
        $table = '';
        $widths = [];

        // Calculate column widths
        foreach ($headers as $i => $header) {
            $widths[$i] = strlen($header);
        }

        foreach ($rows as $row) {
            foreach ($row as $i => $cell) {
                $widths[$i] = max($widths[$i] ?? 0, strlen($cell));
            }
        }

        // Create header row
        foreach ($headers as $i => $header) {
            $table .= str_pad($header, $widths[$i] + 2);
        }
        $table .= "\n";

        // Create separator
        foreach ($widths as $width) {
            $table .= str_repeat('-', $width + 2);
        }
        $table .= "\n";

        // Create data rows
        foreach ($rows as $row) {
            foreach ($row as $i => $cell) {
                $table .= str_pad($cell, $widths[$i] + 2);
            }
            $table .= "\n";
        }

        return $table;
    }
}
