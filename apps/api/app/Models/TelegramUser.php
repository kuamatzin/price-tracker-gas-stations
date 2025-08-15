<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelegramUser extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'telegram_id',
        'telegram_username',
        'first_name',
        'last_name',
        'language_code',
        'is_bot',
        'registration_token',
        'registered_at',
        'last_interaction',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'telegram_id' => 'integer',
        'is_bot' => 'boolean',
        'registered_at' => 'datetime',
        'last_interaction' => 'datetime',
    ];

    /**
     * Get the user that owns the telegram account.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Update last interaction timestamp
     */
    public function touchInteraction(): void
    {
        $this->update(['last_interaction' => now()]);
    }

    /**
     * Generate a new registration token
     */
    public function generateRegistrationToken(): string
    {
        $token = bin2hex(random_bytes(16));
        $this->update(['registration_token' => $token]);
        return $token;
    }

    /**
     * Clear registration token
     */
    public function clearRegistrationToken(): void
    {
        $this->update(['registration_token' => null]);
    }

    /**
     * Check if user is registered (linked to a FuelIntel account)
     */
    public function isRegistered(): bool
    {
        return $this->user_id !== null;
    }

    /**
     * Get display name
     */
    public function getDisplayName(): string
    {
        if ($this->first_name) {
            return $this->first_name . ($this->last_name ? ' ' . $this->last_name : '');
        }
        
        if ($this->telegram_username) {
            return '@' . $this->telegram_username;
        }
        
        return 'Usuario';
    }
}