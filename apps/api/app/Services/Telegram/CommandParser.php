<?php

namespace App\Services\Telegram;

class CommandParser
{
    /**
     * Parse command from message text
     */
    public function parse(string $text): array
    {
        $text = trim($text);
        
        // Check if it's a command (starts with /)
        if (!str_starts_with($text, '/')) {
            return [
                'is_command' => false,
                'command' => null,
                'arguments' => null,
                'raw_text' => $text
            ];
        }

        // Remove the / and split by space or @ (for bot username)
        $text = substr($text, 1);
        $parts = preg_split('/[\s@]/', $text, 2);
        
        $command = strtolower($parts[0]);
        $arguments = isset($parts[1]) ? trim($parts[1]) : null;

        return [
            'is_command' => true,
            'command' => $command,
            'arguments' => $arguments,
            'raw_text' => $text
        ];
    }

    /**
     * Parse callback data
     */
    public function parseCallback(string $data): array
    {
        // Callback data format: action:param1:param2
        $parts = explode(':', $data);
        
        return [
            'action' => $parts[0] ?? null,
            'params' => array_slice($parts, 1)
        ];
    }

    /**
     * Check if text is a natural language query
     */
    public function isNaturalQuery(string $text): bool
    {
        // Not a command and contains certain keywords
        if (str_starts_with($text, '/')) {
            return false;
        }

        $keywords = [
            // Price keywords
            'precio', 'precios', 'gasolina', 'diesel', 'premium', 'magna',
            'combustible', 'nafta', 'bencina', 'carburante',
            
            // Question keywords
            'cuánto', 'cuanto', 'cuesta', 'está', 'esta', 'vale',
            'costo', 'valor', 'tarifa', 'importe',
            
            // Competition keywords
            'competencia', 'competidor', 'competidores', 'rival', 'rivales',
            'otros', 'cerca', 'cercanos', 'alrededor',
            
            // Analysis keywords
            'promedio', 'media', 'tendencia', 'tendencias', 'histórico',
            'historico', 'ranking', 'posición', 'posicion', 'lugar',
            'comparar', 'comparación', 'comparacion', 'análisis', 'analisis',
            
            // Configuration keywords
            'configurar', 'ajustar', 'cambiar', 'modificar', 'establecer',
            'preferencias', 'opciones', 'settings', 'configuración', 'configuracion',
            
            // Station keywords
            'estación', 'estacion', 'gasolinera', 'pemex', 'shell',
            'mi estación', 'mi estacion', 'mi gasolinera',
            
            // Help keywords
            'ayuda', 'help', 'apoyo', 'soporte', 'asistencia',
            'cómo', 'como', 'qué', 'que', 'información', 'informacion',
            
            // Action keywords
            'mostrar', 'ver', 'dame', 'dime', 'buscar', 'busca',
            'consultar', 'consulta', 'revisar', 'revisa'
        ];

        $text = strtolower($text);
        foreach ($keywords as $keyword) {
            if (str_contains($text, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract fuel type from text
     */
    public function extractFuelType(string $text): ?string
    {
        $text = strtolower($text);
        
        if (str_contains($text, 'premium')) {
            return 'premium';
        }
        if (str_contains($text, 'magna')) {
            return 'regular';
        }
        if (str_contains($text, 'regular')) {
            return 'regular';
        }
        if (str_contains($text, 'diesel') || str_contains($text, 'diésel')) {
            return 'diesel';
        }
        
        return null;
    }

    /**
     * Extract time period from text
     */
    public function extractTimePeriod(string $text): ?int
    {
        $text = strtolower($text);
        
        // Look for patterns like "7 días", "30 dias", "1 semana", "2 semanas", "1 mes"
        if (preg_match('/(\d+)\s*(día|dias|day|days)/i', $text, $matches)) {
            return (int) $matches[1];
        }
        
        if (preg_match('/(\d+)\s*(semana|semanas|week|weeks)/i', $text, $matches)) {
            return (int) $matches[1] * 7;
        }
        
        if (preg_match('/(\d+)\s*(mes|meses|month|months)/i', $text, $matches)) {
            return (int) $matches[1] * 30;
        }
        
        return null;
    }

    /**
     * Extract station name from text
     */
    public function extractStationName(string $text): ?string
    {
        $text = strtolower($text);
        
        // Look for patterns like "pemex centro", "shell norte", etc.
        $brands = ['pemex', 'shell', 'mobil', 'chevron', 'bp', 'arco', 'oxxo', 'g500'];
        
        foreach ($brands as $brand) {
            if (str_contains($text, $brand)) {
                // Extract the part after the brand name
                $pattern = '/' . $brand . '\s+(.+?)(?:\s|$)/i';
                if (preg_match($pattern, $text, $matches)) {
                    return $brand . ' ' . $matches[1];
                }
                return $brand;
            }
        }
        
        return null;
    }

    /**
     * Clean command text (remove bot username if present)
     */
    public function cleanCommand(string $text): string
    {
        // Remove bot username (e.g., /start@fuelintel_bot becomes /start)
        if (str_contains($text, '@')) {
            $parts = explode('@', $text);
            return $parts[0];
        }
        
        return $text;
    }
}