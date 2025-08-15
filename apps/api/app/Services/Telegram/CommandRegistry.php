<?php

namespace App\Services\Telegram;

use Illuminate\Support\Collection;

class CommandRegistry
{
    /**
     * Registered commands
     */
    protected Collection $commands;

    /**
     * Command aliases
     */
    protected array $aliases = [
        'inicio' => 'start',
        'ayuda' => 'help',
        'menu' => 'comandos',
        'precio' => 'precios',
        'competidores' => 'precios_competencia',
        'promedio' => 'precio_promedio',
        'tendencias' => 'tendencia',
        'posicion' => 'ranking',
        'config' => 'configurar',
        'estacion' => 'mi_estacion',
        'alertas' => 'notificaciones',
        'pausar' => 'silencio',
        'idioma' => 'language',
        'lang' => 'language',
    ];

    /**
     * Command categories
     */
    protected array $categories = [
        'precios' => [
            'precios',
            'precios_competencia',
            'precio_promedio',
        ],
        'analisis' => [
            'tendencia',
            'ranking',
            'historial',
        ],
        'configuracion' => [
            'configurar',
            'mi_estacion',
            'notificaciones',
            'silencio',
            'language',
        ],
        'ayuda' => [
            'help',
            'comandos',
            'start',
        ],
    ];

    public function __construct()
    {
        $this->commands = new Collection();
    }

    /**
     * Register a command
     */
    public function register(string $name, string $className): void
    {
        $this->commands->put($name, $className);
    }

    /**
     * Get command class by name
     */
    public function get(string $name): ?string
    {
        // Check if it's an alias
        if (isset($this->aliases[$name])) {
            $name = $this->aliases[$name];
        }

        return $this->commands->get($name);
    }

    /**
     * Get all commands
     */
    public function all(): Collection
    {
        return $this->commands;
    }

    /**
     * Get commands by category
     */
    public function getByCategory(string $category): array
    {
        return $this->categories[$category] ?? [];
    }

    /**
     * Get all categories
     */
    public function getCategories(): array
    {
        return array_keys($this->categories);
    }

    /**
     * Check if command exists
     */
    public function has(string $name): bool
    {
        if (isset($this->aliases[$name])) {
            $name = $this->aliases[$name];
        }

        return $this->commands->has($name);
    }

    /**
     * Get command name from alias
     */
    public function resolveAlias(string $alias): string
    {
        return $this->aliases[$alias] ?? $alias;
    }

    /**
     * Register multiple commands at once
     */
    public function registerMany(array $commands): void
    {
        foreach ($commands as $name => $className) {
            $this->register($name, $className);
        }
    }

    /**
     * Get similar commands (for suggestions)
     */
    public function getSimilar(string $input, int $maxDistance = 3): array
    {
        $similar = [];

        foreach ($this->commands->keys() as $command) {
            $distance = levenshtein($input, $command);
            if ($distance <= $maxDistance) {
                $similar[$command] = $distance;
            }
        }

        // Check aliases too
        foreach (array_keys($this->aliases) as $alias) {
            $distance = levenshtein($input, $alias);
            if ($distance <= $maxDistance) {
                $resolvedCommand = $this->aliases[$alias];
                if (!isset($similar[$resolvedCommand]) || $similar[$resolvedCommand] > $distance) {
                    $similar[$resolvedCommand] = $distance;
                }
            }
        }

        asort($similar);
        return array_slice(array_keys($similar), 0, 3);
    }
}