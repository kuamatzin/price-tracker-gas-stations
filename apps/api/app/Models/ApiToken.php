<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'token',
        'abilities',
        'last_used_at',
        'expires_at',
    ];

    protected $casts = [
        'abilities' => 'array',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected $hidden = [
        'token',
    ];

    /**
     * Generate a new API token
     */
    public static function generate(string $name, array $abilities = ['*'], ?int $expiresInDays = null): self
    {
        $token = Str::random(60);

        return self::create([
            'name' => $name,
            'token' => hash('sha256', $token),
            'abilities' => $abilities,
            'expires_at' => $expiresInDays ? now()->addDays($expiresInDays) : null,
        ]);
    }

    /**
     * Find token by plain text token
     */
    public static function findByToken(string $plainToken): ?self
    {
        $hashedToken = hash('sha256', $plainToken);

        return self::where('token', $hashedToken)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->first();
    }

    /**
     * Check if token has specific ability
     */
    public function can(string $ability): bool
    {
        if (in_array('*', $this->abilities)) {
            return true;
        }

        return in_array($ability, $this->abilities);
    }

    /**
     * Check if token is expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    /**
     * Update last used timestamp
     */
    public function touch(): void
    {
        $this->update(['last_used_at' => now()]);
    }

    /**
     * Scope for service tokens (no expiration)
     */
    public function scopeService($query)
    {
        return $query->whereNull('expires_at');
    }
}
