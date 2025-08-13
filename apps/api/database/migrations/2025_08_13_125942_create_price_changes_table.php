<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('price_changes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('station_numero', 50);
            $table->string('fuel_type', 10);
            $table->text('subproducto'); // Original government description
            $table->decimal('price', 5, 2);
            $table->timestamp('changed_at'); // When price actually changed
            $table->timestamp('detected_at')->useCurrent(); // When we detected the change
            
            $table->foreign('station_numero')->references('numero')->on('stations')->onDelete('cascade');
            
            // Indexes for performance
            $table->index('station_numero', 'idx_station');
            $table->index('changed_at', 'idx_changed');
            $table->index(['station_numero', 'fuel_type'], 'idx_station_fuel');
            $table->index(['station_numero', 'fuel_type', 'changed_at'], 'idx_station_fuel_changed');
        });
        
        // Add CHECK constraint for fuel_type (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE price_changes ADD CONSTRAINT check_fuel_type CHECK (fuel_type IN ('regular', 'premium', 'diesel'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('price_changes');
    }
};