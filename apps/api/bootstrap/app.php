<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api/v1.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \App\Http\Middleware\RequestId::class,
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\LogRequests::class,
        ]);
        
        $middleware->alias([
            'webhook.signature' => \App\Http\Middleware\VerifyWebhookSignature::class,
            'api.token' => \App\Http\Middleware\AuthenticateApiToken::class,
        ]);
        
        $middleware->throttleApi('60,1');
        
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Throwable $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return app(\App\Exceptions\Handler::class)->renderForApi($e, $request);
            }
        });
    })->create();
