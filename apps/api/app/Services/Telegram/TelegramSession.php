<?php

namespace App\Services\Telegram;

class TelegramSession
{
    /**
     * Session data
     */
    protected array $data;

    /**
     * Create a new session instance
     */
    public function __construct(array $data = [])
    {
        $this->data = $data;
        
        // Set default values
        if (!isset($this->data['created_at'])) {
            $this->data['created_at'] = time();
        }
        
        $this->data['updated_at'] = time();
    }

    /**
     * Get a value from the session
     */
    public function get(string $key, $default = null)
    {
        return $this->data[$key] ?? $default;
    }

    /**
     * Set a value in the session
     */
    public function put(string $key, $value): void
    {
        $this->data[$key] = $value;
        $this->data['updated_at'] = time();
    }

    /**
     * Set multiple values at once
     */
    public function putMany(array $values): void
    {
        foreach ($values as $key => $value) {
            $this->data[$key] = $value;
        }
        $this->data['updated_at'] = time();
    }

    /**
     * Check if a key exists in the session
     */
    public function has(string $key): bool
    {
        return isset($this->data[$key]);
    }

    /**
     * Remove a value from the session
     */
    public function forget(string $key): void
    {
        unset($this->data[$key]);
        $this->data['updated_at'] = time();
    }

    /**
     * Clear all session data except user_id
     */
    public function flush(): void
    {
        $userId = $this->data['user_id'] ?? null;
        $this->data = [];
        
        if ($userId) {
            $this->data['user_id'] = $userId;
        }
        
        $this->data['created_at'] = time();
        $this->data['updated_at'] = time();
    }

    /**
     * Get the user ID
     */
    public function getUserId(): ?int
    {
        return $this->data['user_id'] ?? null;
    }

    /**
     * Set the user ID
     */
    public function setUserId(int $userId): void
    {
        $this->data['user_id'] = $userId;
    }

    /**
     * Get conversation state
     */
    public function getState(): ?string
    {
        return $this->data['state'] ?? null;
    }

    /**
     * Set conversation state
     */
    public function setState(string $state): void
    {
        $this->data['state'] = $state;
        $this->data['updated_at'] = time();
    }

    /**
     * Clear conversation state
     */
    public function clearState(): void
    {
        unset($this->data['state']);
        unset($this->data['state_data']);
        $this->data['updated_at'] = time();
    }

    /**
     * Get state data
     */
    public function getStateData(): array
    {
        return $this->data['state_data'] ?? [];
    }

    /**
     * Set state data
     */
    public function setStateData(array $data): void
    {
        $this->data['state_data'] = $data;
        $this->data['updated_at'] = time();
    }

    /**
     * Add to state data
     */
    public function addStateData(string $key, $value): void
    {
        if (!isset($this->data['state_data'])) {
            $this->data['state_data'] = [];
        }
        
        $this->data['state_data'][$key] = $value;
        $this->data['updated_at'] = time();
    }

    /**
     * Get language preference
     */
    public function getLanguage(): string
    {
        return $this->data['language'] ?? 'es';
    }

    /**
     * Set language preference
     */
    public function setLanguage(string $language): void
    {
        $this->data['language'] = $language;
        $this->data['updated_at'] = time();
    }

    /**
     * Check if session is in a conversation flow
     */
    public function isInConversation(): bool
    {
        return isset($this->data['state']);
    }

    /**
     * Get session age in seconds
     */
    public function getAge(): int
    {
        $createdAt = $this->data['created_at'] ?? time();
        return time() - $createdAt;
    }

    /**
     * Get time since last update in seconds
     */
    public function getIdleTime(): int
    {
        $updatedAt = $this->data['updated_at'] ?? time();
        return time() - $updatedAt;
    }

    /**
     * Convert session to array
     */
    public function toArray(): array
    {
        return $this->data;
    }

    /**
     * Create session from array
     */
    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    /**
     * Get conversation context for NLP
     */
    public function getConversationContext(): array
    {
        return $this->data['conversation_context'] ?? [];
    }

    /**
     * Set conversation context for NLP
     */
    public function setConversationContext(array $context): void
    {
        $this->data['conversation_context'] = $context;
        $this->data['conversation_context']['updated_at'] = time();
        $this->data['updated_at'] = time();
    }

    /**
     * Merge new context with existing conversation context
     */
    public function mergeConversationContext(array $newContext): void
    {
        $existing = $this->getConversationContext();
        
        // Merge entities
        if (isset($newContext['entities']) && isset($existing['entities'])) {
            $newContext['entities'] = array_merge($existing['entities'], $newContext['entities']);
        }
        
        // Keep track of last intent
        if (isset($existing['intent'])) {
            $newContext['last_intent'] = $existing['intent'];
        }
        
        // Merge and update
        $merged = array_merge($existing, $newContext);
        $merged['updated_at'] = time();
        
        $this->setConversationContext($merged);
    }

    /**
     * Check if conversation context is expired (5 minutes default)
     */
    public function isContextExpired(int $ttl = null): bool
    {
        $ttl = $ttl ?? config('deepseek.context_ttl_seconds', 300);
        $context = $this->getConversationContext();
        
        if (empty($context) || !isset($context['updated_at'])) {
            return true;
        }
        
        return (time() - $context['updated_at']) > $ttl;
    }

    /**
     * Clear expired conversation context
     */
    public function clearExpiredContext(int $ttl = null): void
    {
        if ($this->isContextExpired($ttl)) {
            unset($this->data['conversation_context']);
            $this->data['updated_at'] = time();
        }
    }

    /**
     * Get last query intent from context
     */
    public function getLastIntent(): ?string
    {
        $context = $this->getConversationContext();
        return $context['intent'] ?? $context['last_intent'] ?? null;
    }

    /**
     * Get last extracted entities from context
     */
    public function getLastEntities(): array
    {
        $context = $this->getConversationContext();
        return $context['entities'] ?? [];
    }

    /**
     * Add query to conversation history
     */
    public function addToHistory(string $query, string $response): void
    {
        if (!isset($this->data['conversation_history'])) {
            $this->data['conversation_history'] = [];
        }
        
        // Keep only last 5 exchanges
        if (count($this->data['conversation_history']) >= 5) {
            array_shift($this->data['conversation_history']);
        }
        
        $this->data['conversation_history'][] = [
            'query' => $query,
            'response' => $response,
            'timestamp' => time()
        ];
        
        $this->data['updated_at'] = time();
    }

    /**
     * Get conversation history
     */
    public function getConversationHistory(): array
    {
        return $this->data['conversation_history'] ?? [];
    }
}