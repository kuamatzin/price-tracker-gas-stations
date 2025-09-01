<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

class VerifyWebhookSignature
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $webhookType)
    {
        $signature = $request->header('X-Webhook-Signature');

        if (! $signature) {
            Log::warning('Webhook request missing signature', [
                'type' => $webhookType,
                'ip' => $request->ip(),
            ]);
            throw new UnauthorizedHttpException('', 'Missing webhook signature');
        }

        $secret = $this->getWebhookSecret($webhookType);

        if (! $secret) {
            Log::error('Webhook secret not configured', ['type' => $webhookType]);
            throw new \RuntimeException('Webhook secret not configured');
        }

        $payload = $request->getContent();
        $expectedSignature = 'sha256='.hash_hmac('sha256', $payload, $secret);

        // Use hash_equals to prevent timing attacks
        if (! hash_equals($expectedSignature, $signature)) {
            Log::warning('Invalid webhook signature', [
                'type' => $webhookType,
                'ip' => $request->ip(),
                'provided' => substr($signature, 0, 20).'...',
            ]);
            throw new UnauthorizedHttpException('', 'Invalid webhook signature');
        }

        Log::info('Webhook signature verified', [
            'type' => $webhookType,
        ]);

        return $next($request);
    }

    /**
     * Get the webhook secret for the given type
     */
    protected function getWebhookSecret(string $type): ?string
    {
        return match ($type) {
            'scraper' => config('scraper.webhook_secret'),
            default => null,
        };
    }
}
