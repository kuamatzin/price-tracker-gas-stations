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
        Schema::create('stations', function (Blueprint $table) {
            $table->string('numero', 50)->primary(); // Government permit number
            $table->string('nombre', 255);
            $table->text('direccion')->nullable();
            $table->decimal('lat', 10, 8)->nullable();
            $table->decimal('lng', 11, 8)->nullable();
            $table->integer('entidad_id');
            $table->integer('municipio_id');
            $table->string('brand', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('entidad_id')->references('id')->on('entidades');
            $table->foreign('municipio_id')->references('id')->on('municipios');
            $table->index(['entidad_id', 'municipio_id'], 'idx_location');
            $table->index(['lat', 'lng'], 'idx_coords');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stations');
    }
};
