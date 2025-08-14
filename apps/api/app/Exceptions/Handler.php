<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Auth\AuthenticationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];
    
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            if (app()->bound('sentry')) {
                app('sentry')->captureException($e);
            }
        });
    }
    
    public function renderForApi(Throwable $e, Request $request): JsonResponse
    {
        $requestId = $request->header('X-Request-ID', uniqid('err_'));
        
        $response = [
            'success' => false,
            'request_id' => $requestId,
        ];
        
        if ($e instanceof ValidationException) {
            $response['message'] = 'Validation failed';
            $response['errors'] = $e->errors();
            $statusCode = 422;
        } elseif ($e instanceof ModelNotFoundException) {
            $response['message'] = 'Resource not found';
            $statusCode = 404;
        } elseif ($e instanceof NotFoundHttpException) {
            $response['message'] = 'Endpoint not found';
            $statusCode = 404;
        } elseif ($e instanceof AuthenticationException) {
            $response['message'] = 'Unauthenticated';
            $statusCode = 401;
        } elseif ($e instanceof MethodNotAllowedHttpException) {
            $response['message'] = 'Method not allowed';
            $response['allowed_methods'] = $e->getHeaders()['Allow'] ?? [];
            $statusCode = 405;
        } elseif ($e instanceof HttpException) {
            $response['message'] = $e->getMessage() ?: 'HTTP error';
            $statusCode = $e->getStatusCode();
        } else {
            $response['message'] = config('app.debug') ? $e->getMessage() : 'Internal server error';
            
            if (config('app.debug')) {
                $response['exception'] = get_class($e);
                $response['file'] = $e->getFile();
                $response['line'] = $e->getLine();
                $response['trace'] = collect($e->getTrace())->take(5)->toArray();
            }
            
            $statusCode = 500;
        }
        
        return response()->json($response, $statusCode)
            ->header('X-Request-ID', $requestId);
    }
}