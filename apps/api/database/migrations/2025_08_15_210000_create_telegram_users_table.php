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
        Schema::create('telegram_users', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->bigInteger('telegram_id')->unique();
            $table->string('telegram_username')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('language_code', 10)->default('es');
            $table->boolean('is_bot')->default(false);
            $table->string('registration_token', 64)->nullable();
            $table->timestamp('registered_at')->useCurrent();
            $table->timestamp('last_interaction')->nullable();
            $table->timestamps();

            $table->index('telegram_id');
            $table->index('user_id');
            $table->index('registration_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_users');
    }
};
