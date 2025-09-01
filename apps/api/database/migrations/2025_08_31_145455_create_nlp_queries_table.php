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
        Schema::create('nlp_queries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('chat_id');
            $table->text('original_query');
            $table->text('normalized_query')->nullable();
            $table->string('interpreted_intent', 100)->nullable();
            $table->jsonb('extracted_entities')->nullable();
            $table->decimal('confidence', 3, 2)->nullable();
            $table->integer('response_time_ms')->nullable();
            $table->boolean('used_deepseek')->default(false);
            $table->string('command_executed', 100)->nullable();
            $table->boolean('success')->nullable();
            $table->jsonb('fallback_suggested')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index('chat_id');
            $table->index('interpreted_intent');
            $table->index('confidence');
            $table->index('created_at');
            $table->index(['used_deepseek', 'created_at']);

            // Foreign key
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nlp_queries');
    }
};
