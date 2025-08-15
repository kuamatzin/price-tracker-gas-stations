<?php

namespace App\Telegram\Commands;

use Telegram\Bot\Commands\Command;
use App\Services\Telegram\SessionManager;
use App\Services\Telegram\TranslationService;

abstract class BaseCommand extends Command
{
    protected ?SessionManager $sessionManager = null;
    protected ?TranslationService $translator = null;

    public function __construct()
    {
        $this->sessionManager = app(SessionManager::class);
        $this->translator = app(TranslationService::class);
    }

    /**
     * Get user's preferred language
     */
    protected function getUserLanguage($userId): string
    {
        $session = $this->sessionManager->getSession($userId);
        return $session->get('language', 'es');
    }

    /**
     * Translate a message key
     */
    protected function trans(string $key, array $params = [], ?int $userId = null): string
    {
        $lang = $userId ? $this->getUserLanguage($userId) : 'es';
        return $this->translator->get($key, $params, $lang);
    }

    /**
     * Send typing action to show bot is processing
     */
    protected function sendTypingAction($chatId): void
    {
        $this->telegram->sendChatAction([
            'chat_id' => $chatId,
            'action' => 'typing'
        ]);
    }

    /**
     * Reply with a formatted error message
     */
    protected function replyWithError(string $message, $chatId = null): void
    {
        $chatId = $chatId ?? $this->getUpdate()->getMessage()->getChat()->getId();
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => "❌ " . $message,
            'parse_mode' => 'Markdown'
        ]);
    }

    /**
     * Reply with a formatted success message
     */
    protected function replyWithSuccess(string $message, $chatId = null): void
    {
        $chatId = $chatId ?? $this->getUpdate()->getMessage()->getChat()->getId();
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => "✅ " . $message,
            'parse_mode' => 'Markdown'
        ]);
    }

    /**
     * Get user ID from update
     */
    protected function getUserId(): ?int
    {
        $message = $this->getUpdate()->getMessage();
        $callbackQuery = $this->getUpdate()->getCallbackQuery();
        
        if ($message) {
            return $message->getFrom()->getId();
        } elseif ($callbackQuery) {
            return $callbackQuery->getFrom()->getId();
        }
        
        return null;
    }

    /**
     * Get chat ID from update
     */
    protected function getChatId(): ?int
    {
        $message = $this->getUpdate()->getMessage();
        $callbackQuery = $this->getUpdate()->getCallbackQuery();
        
        if ($message) {
            return $message->getChat()->getId();
        } elseif ($callbackQuery) {
            return $callbackQuery->getMessage()->getChat()->getId();
        }
        
        return null;
    }
}