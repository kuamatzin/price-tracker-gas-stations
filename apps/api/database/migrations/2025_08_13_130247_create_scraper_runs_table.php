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
        Schema::create('scraper_runs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->string('status', 10)->default('running');
            $table->integer('estados_processed')->default(0);
            $table->integer('municipios_processed')->default(0);
            $table->integer('stations_found')->default(0);
            $table->integer('price_changes_detected')->default(0);
            $table->jsonb('errors')->nullable();

            $table->index(['started_at', 'status']);
            $table->timestamps();
        });

        // Add CHECK constraint for status (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE scraper_runs ADD CONSTRAINT check_scraper_status CHECK (status IN ('running', 'completed', 'failed'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scraper_runs');
    }
};
