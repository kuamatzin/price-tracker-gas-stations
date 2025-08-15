<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Only create view and indexes if using MySQL/PostgreSQL
        if (config('database.default') !== 'sqlite') {
            // Create materialized view for market aggregates
            DB::statement("
                CREATE OR REPLACE VIEW market_daily_aggregates AS
                SELECT
                    DATE(changed_at) as date,
                    s.entidad_id,
                    s.municipio_id,
                    pc.fuel_type,
                    AVG(price) as avg_price,
                    MIN(price) as min_price,
                    MAX(price) as max_price,
                    STDDEV(price) as stddev_price,
                    COUNT(DISTINCT pc.station_numero) as station_count,
                    COUNT(*) as sample_count
                FROM price_changes pc
                JOIN stations s ON pc.station_numero = s.numero
                GROUP BY DATE(changed_at), s.entidad_id, s.municipio_id, pc.fuel_type
            ");
        }

        // Create indexes for better performance (works in all databases)
        try {
            Schema::table('price_changes', function ($table) {
                $table->index('changed_at', 'idx_market_daily_date');
            });
        } catch (\Exception $e) {
            // Index might already exist
        }
        
        try {
            Schema::table('price_changes', function ($table) {
                $table->index(['station_numero', 'fuel_type', 'changed_at'], 'idx_market_daily_station_fuel');
            });
        } catch (\Exception $e) {
            // Index might already exist
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (config('database.default') !== 'sqlite') {
            DB::statement("DROP VIEW IF EXISTS market_daily_aggregates");
        }
        
        try {
            Schema::table('price_changes', function ($table) {
                $table->dropIndex('idx_market_daily_date');
            });
        } catch (\Exception $e) {
            // Index might not exist
        }
        
        try {
            Schema::table('price_changes', function ($table) {
                $table->dropIndex('idx_market_daily_station_fuel');
            });
        } catch (\Exception $e) {
            // Index might not exist
        }
    }
};
