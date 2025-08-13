<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LocationSeeder extends Seeder
{
    private const API_BASE_URL = 'https://api-catalogo.cne.gob.mx/api/utiles';
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY = 5; // seconds

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Starting location data import...');
        
        // Load all estados (states)
        $estados = $this->fetchEstados();
        
        if (empty($estados)) {
            $this->command->error('Failed to fetch estados from API');
            return;
        }
        
        $this->command->info(sprintf('Found %d estados to import', count($estados)));
        
        // Process each estado
        foreach ($estados as $estado) {
            $this->processEstado($estado);
        }
        
        $this->command->info('Location data import completed successfully!');
    }

    /**
     * Fetch all estados from the government API
     */
    private function fetchEstados(): array
    {
        $url = self::API_BASE_URL . '/entidadesfederativas';
        
        for ($attempt = 1; $attempt <= self::MAX_RETRIES; $attempt++) {
            try {
                $response = Http::timeout(30)->get($url);
                
                if ($response->successful()) {
                    return $response->json();
                }
                
                Log::warning("Failed to fetch estados (attempt {$attempt})", [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                
            } catch (\Exception $e) {
                Log::error("Exception fetching estados (attempt {$attempt})", [
                    'error' => $e->getMessage()
                ]);
            }
            
            if ($attempt < self::MAX_RETRIES) {
                sleep(self::RETRY_DELAY);
            }
        }
        
        return [];
    }

    /**
     * Process a single estado and its municipios
     */
    private function processEstado(array $estado): void
    {
        $estadoId = $estado['EntidadFederativaId'] ?? null;
        $estadoNombre = $estado['EntidadFederativaNombre'] ?? null;
        
        if (!$estadoId || !$estadoNombre) {
            $this->command->warn("Skipping estado with missing data: " . json_encode($estado));
            return;
        }
        
        // Insert or update estado
        DB::table('entidades')->updateOrInsert(
            ['id' => $estadoId],
            [
                'nombre' => $estadoNombre,
                'codigo' => $this->getEstadoCodigo($estadoNombre),
                'created_at' => now(),
                'updated_at' => now()
            ]
        );
        
        $this->command->info("Processed estado: {$estadoNombre}");
        
        // Fetch and process municipios for this estado
        $municipios = $this->fetchMunicipios($estadoId);
        
        if (!empty($municipios)) {
            $this->processMunicipios($estadoId, $municipios);
            $this->command->info(sprintf('  - Imported %d municipios', count($municipios)));
        } else {
            $this->command->warn("  - No municipios found for estado {$estadoNombre}");
        }
    }

    /**
     * Fetch municipios for a specific estado
     */
    private function fetchMunicipios(int $estadoId): array
    {
        $url = self::API_BASE_URL . '/municipios?EntidadFederativaId=' . $estadoId;
        
        for ($attempt = 1; $attempt <= self::MAX_RETRIES; $attempt++) {
            try {
                $response = Http::timeout(30)->get($url);
                
                if ($response->successful()) {
                    return $response->json();
                }
                
                Log::warning("Failed to fetch municipios for estado {$estadoId} (attempt {$attempt})", [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                
            } catch (\Exception $e) {
                Log::error("Exception fetching municipios for estado {$estadoId} (attempt {$attempt})", [
                    'error' => $e->getMessage()
                ]);
            }
            
            if ($attempt < self::MAX_RETRIES) {
                sleep(self::RETRY_DELAY);
            }
        }
        
        return [];
    }

    /**
     * Process municipios for an estado
     */
    private function processMunicipios(int $estadoId, array $municipios): void
    {
        $data = [];
        
        foreach ($municipios as $municipio) {
            $municipioId = $municipio['MunicipioId'] ?? null;
            $municipioNombre = $municipio['MunicipioNombre'] ?? null;
            
            if (!$municipioId || !$municipioNombre) {
                continue;
            }
            
            $data[] = [
                'id' => $municipioId,
                'entidad_id' => $estadoId,
                'nombre' => $municipioNombre,
                'created_at' => now(),
                'updated_at' => now()
            ];
        }
        
        if (!empty($data)) {
            // Use upsert to handle duplicates
            DB::table('municipios')->upsert(
                $data,
                ['id'], // unique key
                ['nombre', 'updated_at'] // columns to update on conflict
            );
        }
    }

    /**
     * Get estado codigo based on name
     */
    private function getEstadoCodigo(string $nombre): ?string
    {
        $codigos = [
            'Aguascalientes' => 'AGS',
            'Baja California' => 'BC',
            'Baja California Sur' => 'BCS',
            'Campeche' => 'CAMP',
            'Chiapas' => 'CHIS',
            'Chihuahua' => 'CHIH',
            'Coahuila de Zaragoza' => 'COAH',
            'Colima' => 'COL',
            'Ciudad de México' => 'CDMX',
            'Durango' => 'DGO',
            'Guanajuato' => 'GTO',
            'Guerrero' => 'GRO',
            'Hidalgo' => 'HGO',
            'Jalisco' => 'JAL',
            'México' => 'MEX',
            'Michoacán de Ocampo' => 'MICH',
            'Morelos' => 'MOR',
            'Nayarit' => 'NAY',
            'Nuevo León' => 'NL',
            'Oaxaca' => 'OAX',
            'Puebla' => 'PUE',
            'Querétaro' => 'QRO',
            'Quintana Roo' => 'QROO',
            'San Luis Potosí' => 'SLP',
            'Sinaloa' => 'SIN',
            'Sonora' => 'SON',
            'Tabasco' => 'TAB',
            'Tamaulipas' => 'TAMPS',
            'Tlaxcala' => 'TLAX',
            'Veracruz de Ignacio de la Llave' => 'VER',
            'Yucatán' => 'YUC',
            'Zacatecas' => 'ZAC'
        ];
        
        return $codigos[$nombre] ?? null;
    }
}