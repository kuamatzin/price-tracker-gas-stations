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
        Schema::create('alert_notifications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('alert_id');
            $table->timestamp('triggered_at')->useCurrent();
            $table->string('channel', 10);
            $table->boolean('delivered')->default(false);
            $table->text('content')->nullable();
            
            $table->foreign('alert_id')->references('id')->on('alerts')->onDelete('cascade');
            $table->index(['alert_id', 'triggered_at'], 'idx_alert_time');
        });
        
        // Add CHECK constraint for channel (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE alert_notifications ADD CONSTRAINT check_channel CHECK (channel IN ('telegram', 'email', 'web'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alert_notifications');
    }
};