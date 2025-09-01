<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('
                CREATE MATERIALIZED VIEW IF NOT EXISTS competitor_current_prices AS
                SELECT
                    s.numero,
                    s.nombre,
                    s.brand,
                    s.lat,
                    s.lng,
                    s.municipio_id,
                    s.entidad_id,
                    pc.fuel_type,
                    pc.price,
                    pc.changed_at
                FROM stations s
                JOIN LATERAL (
                    SELECT DISTINCT ON (fuel_type)
                        fuel_type,
                        price,
                        changed_at
                    FROM price_changes
                    WHERE station_numero = s.numero
                    ORDER BY fuel_type, changed_at DESC
                ) pc ON true
                WHERE s.is_active = true
            ');

            DB::statement('
                CREATE INDEX IF NOT EXISTS idx_competitor_prices_location
                ON competitor_current_prices(municipio_id, fuel_type)
            ');

            DB::statement('
                CREATE INDEX IF NOT EXISTS idx_competitor_prices_numero
                ON competitor_current_prices(numero)
            ');

            DB::statement('
                CREATE INDEX IF NOT EXISTS idx_competitor_prices_brand
                ON competitor_current_prices(brand, fuel_type)
            ');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('DROP MATERIALIZED VIEW IF EXISTS competitor_current_prices CASCADE');
        }
    }
};
