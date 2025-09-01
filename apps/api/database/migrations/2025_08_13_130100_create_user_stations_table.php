<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_stations', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->string('station_numero', 50);
            $table->string('role', 10)->default('viewer');
            $table->timestamps();

            $table->primary(['user_id', 'station_numero']);
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('station_numero')->references('numero')->on('stations')->onDelete('cascade');
        });

        // Add CHECK constraint for role (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE user_stations ADD CONSTRAINT check_role CHECK (role IN ('owner', 'manager', 'viewer'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_stations');
    }
};
