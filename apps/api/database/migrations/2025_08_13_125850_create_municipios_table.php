<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('municipios', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->integer('entidad_id');
            $table->string('nombre', 150);
            $table->timestamps();
            
            $table->foreign('entidad_id')->references('id')->on('entidades')->onDelete('cascade');
            $table->index('entidad_id', 'idx_entidad');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('municipios');
    }
};