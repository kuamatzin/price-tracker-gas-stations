<?php

namespace App\Http\Controllers;

use App\Services\Telegram\CallbackHandler;
use App\Services\Telegram\MessageRouter;
use App\Services\Telegram\SessionManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Telegram\Bot\Laravel\Facades\Telegram;

class TelegramController extends Controller
{
    protected MessageRouter $router;

    protected SessionManager $sessionManager;

    protected CallbackHandler $callbackHandler;

    public function __construct(
        MessageRouter $router,
        SessionManager $sessionManager,
        CallbackHandler $callbackHandler
    ) {
        $this->router = $router;
        $this->sessionManager = $sessionManager;
        $this->callbackHandler = $callbackHandler;
    }

    /**
     * Handle incoming webhook from Telegram
     */
    public function webhook(Request $request)
    {
        try {
            // Get the webhook update
            $update = Telegram::commandsHandler(true);

            // Get chat ID and user info
            $message = $update->getMessage();
            $callbackQuery = $update->getCallbackQuery();

            if ($message) {
                $chatId = $message->getChat()->getId();
                $userId = $message->getFrom()->getId();
            } elseif ($callbackQuery) {
                $chatId = $callbackQuery->getMessage()->getChat()->getId();
                $userId = $callbackQuery->getFrom()->getId();
            } else {
                return response()->json(['ok' => true]);
            }

            // Load or create session
            $session = $this->sessionManager->getSession($userId);

            // Handle callback queries (button presses)
            if ($callbackQuery) {
                $this->callbackHandler->handle($callbackQuery, $session);
            } else {
                // Route regular messages/commands
                $this->router->route($update, $session);
            }

            // Save session state
            $this->sessionManager->saveSession($session);

            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            Log::error('Telegram webhook error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['ok' => false], 500);
        }
    }

    /**
     * Set webhook URL for production
     */
    public function setWebhook()
    {
        try {
            $url = config('telegram.bots.fuelintel.webhook_url');

            $response = Telegram::setWebhook([
                'url' => $url,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Webhook set successfully',
                'response' => $response,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to set webhook',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove webhook (for local development)
     */
    public function removeWebhook()
    {
        try {
            $response = Telegram::removeWebhook();

            return response()->json([
                'success' => true,
                'message' => 'Webhook removed successfully',
                'response' => $response,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove webhook',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get webhook info
     */
    public function getWebhookInfo()
    {
        try {
            $response = Telegram::getWebhookInfo();

            return response()->json([
                'success' => true,
                'info' => $response,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get webhook info',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
