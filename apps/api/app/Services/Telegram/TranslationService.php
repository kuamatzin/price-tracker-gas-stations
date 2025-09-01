<?php

namespace App\Services\Telegram;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

class TranslationService
{
    /**
     * Translations cache
     */
    protected array $translations = [];

    /**
     * Available languages
     */
    protected array $availableLanguages = ['es', 'en'];

    /**
     * Default language
     */
    protected string $defaultLanguage = 'es';

    /**
     * Load translations for a language
     */
    protected function loadTranslations(string $language): array
    {
        if (isset($this->translations[$language])) {
            return $this->translations[$language];
        }

        // Cache key for translations
        $cacheKey = "telegram:translations:{$language}";

        // Try to get from cache
        $cached = Cache::get($cacheKey);
        if ($cached) {
            $this->translations[$language] = $cached;

            return $cached;
        }

        // Load from file
        $path = resource_path("lang/telegram/{$language}.json");

        if (! File::exists($path)) {
            // If language file doesn't exist, use default
            if ($language !== $this->defaultLanguage) {
                return $this->loadTranslations($this->defaultLanguage);
            }

            // Return empty array if default also doesn't exist
            return [];
        }

        $content = File::get($path);
        $translations = json_decode($content, true) ?? [];

        // Cache for 24 hours
        Cache::put($cacheKey, $translations, 86400);

        $this->translations[$language] = $translations;

        return $translations;
    }

    /**
     * Get a translation
     */
    public function get(string $key, array $params = [], ?string $language = null): string
    {
        $language = $language ?? $this->defaultLanguage;

        if (! in_array($language, $this->availableLanguages)) {
            $language = $this->defaultLanguage;
        }

        $translations = $this->loadTranslations($language);

        // Navigate through nested keys (e.g., "welcome.new_user")
        $keys = explode('.', $key);
        $value = $translations;

        foreach ($keys as $k) {
            if (! isset($value[$k])) {
                // If key not found, try default language
                if ($language !== $this->defaultLanguage) {
                    return $this->get($key, $params, $this->defaultLanguage);
                }

                // Return the key itself if not found
                return $key;
            }
            $value = $value[$k];
        }

        // Replace parameters
        if (! empty($params)) {
            foreach ($params as $param => $val) {
                $value = str_replace(":{$param}", $val, $value);
            }
        }

        return $value;
    }

    /**
     * Check if a translation exists
     */
    public function has(string $key, ?string $language = null): bool
    {
        $language = $language ?? $this->defaultLanguage;

        if (! in_array($language, $this->availableLanguages)) {
            return false;
        }

        $translations = $this->loadTranslations($language);

        $keys = explode('.', $key);
        $value = $translations;

        foreach ($keys as $k) {
            if (! isset($value[$k])) {
                return false;
            }
            $value = $value[$k];
        }

        return true;
    }

    /**
     * Get available languages
     */
    public function getAvailableLanguages(): array
    {
        return $this->availableLanguages;
    }

    /**
     * Get language name
     */
    public function getLanguageName(string $code): string
    {
        $names = [
            'es' => 'Español',
            'en' => 'English',
        ];

        return $names[$code] ?? $code;
    }

    /**
     * Clear translations cache
     */
    public function clearCache(): void
    {
        foreach ($this->availableLanguages as $language) {
            Cache::forget("telegram:translations:{$language}");
        }

        $this->translations = [];
    }

    /**
     * Reload translations
     */
    public function reload(): void
    {
        $this->clearCache();

        foreach ($this->availableLanguages as $language) {
            $this->loadTranslations($language);
        }
    }
}
