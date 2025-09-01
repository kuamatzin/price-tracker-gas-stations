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
        // Only create materialized views for PostgreSQL
        if (config('database.default') === 'pgsql') {
            // Create materialized view for estado aggregates
            DB::statement('
                CREATE MATERIALIZED VIEW IF NOT EXISTS estado_price_aggregates AS
                SELECT
                    e.id as estado_id,
                    e.nombre as estado_nombre,
                    e.codigo as estado_codigo,
                    pc.fuel_type,
                    AVG(pc.price) as avg_price,
                    MIN(pc.price) as min_price,
                    MAX(pc.price) as max_price,
                    STDDEV(pc.price) as stddev_price,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pc.price) as median_price,
                    COUNT(DISTINCT s.numero) as station_count,
                    MAX(pc.changed_at) as last_update
                FROM entidades e
                JOIN stations s ON s.entidad_id = e.id
                JOIN LATERAL (
                    SELECT DISTINCT ON (station_numero, fuel_type)
                        station_numero,
                        fuel_type,
                        price,
                        changed_at
                    FROM price_changes
                    WHERE changed_at >= CURRENT_TIMESTAMP - INTERVAL \'24 hours\'
                    ORDER BY station_numero, fuel_type, changed_at DESC
                ) pc ON pc.station_numero = s.numero
                WHERE s.is_active = true
                GROUP BY e.id, e.nombre, e.codigo, pc.fuel_type
            ');

            // Create index on materialized view
            DB::statement('CREATE INDEX idx_estado_aggregates ON estado_price_aggregates(estado_id, fuel_type)');

            // Create materialized view for municipio aggregates
            DB::statement('
                CREATE MATERIALIZED VIEW IF NOT EXISTS municipio_price_aggregates AS
                SELECT
                    m.id as municipio_id,
                    m.nombre as municipio_nombre,
                    m.entidad_id,
                    pc.fuel_type,
                    AVG(pc.price) as avg_price,
                    MIN(pc.price) as min_price,
                    MAX(pc.price) as max_price,
                    STDDEV(pc.price) as stddev_price,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pc.price) as median_price,
                    COUNT(DISTINCT s.numero) as station_count,
                    MAX(pc.changed_at) as last_update
                FROM municipios m
                JOIN stations s ON s.municipio_id = m.id
                JOIN LATERAL (
                    SELECT DISTINCT ON (station_numero, fuel_type)
                        station_numero,
                        fuel_type,
                        price,
                        changed_at
                    FROM price_changes
                    WHERE changed_at >= CURRENT_TIMESTAMP - INTERVAL \'24 hours\'
                    ORDER BY station_numero, fuel_type, changed_at DESC
                ) pc ON pc.station_numero = s.numero
                WHERE s.is_active = true
                GROUP BY m.id, m.nombre, m.entidad_id, pc.fuel_type
            ');

            // Create indexes
            DB::statement('CREATE INDEX idx_municipio_aggregates ON municipio_price_aggregates(municipio_id, fuel_type)');
            DB::statement('CREATE INDEX idx_municipio_by_estado ON municipio_price_aggregates(entidad_id)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('DROP MATERIALIZED VIEW IF EXISTS municipio_price_aggregates');
            DB::statement('DROP MATERIALIZED VIEW IF EXISTS estado_price_aggregates');
        }
    }
};
