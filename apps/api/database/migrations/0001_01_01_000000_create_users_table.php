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
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->string('email', 255)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password', 255);
            $table->string('telegram_chat_id', 50)->unique()->nullable();
            $table->string('subscription_tier', 10)->default('free');
            $table->jsonb('notification_preferences')->nullable();
            $table->integer('api_rate_limit')->default(100);
            $table->rememberToken();
            $table->timestamps();
            
            $table->index('email', 'idx_email');
            $table->index('telegram_chat_id', 'idx_telegram');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
        
        // Add CHECK constraint for subscription_tier (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE users ADD CONSTRAINT check_subscription_tier CHECK (subscription_tier IN ('free', 'basic', 'premium'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
