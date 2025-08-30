<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
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
        $correlationId = $request->header('X-Correlation-ID');
        
        $statusCode = $this->getStatusCode($e);
        $errorCode = $this->getErrorCode($e);
        
        $response = [
            'error' => [
                'status' => $statusCode,
                'code' => $errorCode,
                'title' => $this->getErrorTitle($e),
                'detail' => $this->getErrorDetail($e),
                'hint' => $this->getErrorHint($e),
                'meta' => [
                    'timestamp' => now()->toIso8601String(),
                    'path' => $request->path(),
                    'method' => $request->method(),
                    'request_id' => $requestId,
                    'correlation_id' => $correlationId,
                ]
            ]
        ];
        
        // Add validation errors if present
        if ($e instanceof ValidationException) {
            $response['error']['validation_errors'] = $e->errors();
        }
        
        // Add allowed methods for method not allowed errors
        if ($e instanceof MethodNotAllowedHttpException) {
            $response['error']['allowed_methods'] = explode(', ', $e->getHeaders()['Allow'] ?? '');
        }
        
        // Add debug information in non-production environments
        if (config('app.debug')) {
            $response['error']['debug'] = [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => collect($e->getTrace())->take(5)->toArray(),
            ];
        }
        
        return response()->json($response, $statusCode)
            ->header('X-Request-ID', $requestId);
    }
    
    /**
     * Get the HTTP status code for the exception.
     */
    protected function getStatusCode(Throwable $e): int
    {
        if ($e instanceof HttpException) {
            return $e->getStatusCode();
        }
        
        $statusCodes = [
            ValidationException::class => 422,
            AuthenticationException::class => 401,
            AuthorizationException::class => 403,
            ModelNotFoundException::class => 404,
            NotFoundHttpException::class => 404,
            MethodNotAllowedHttpException::class => 405,
            TooManyRequestsHttpException::class => 429,
        ];
        
        return $statusCodes[get_class($e)] ?? 500;
    }
    
    /**
     * Get a unique error code for the exception.
     */
    protected function getErrorCode(Throwable $e): string
    {
        $errorCodes = [
            ValidationException::class => 'VALIDATION_ERROR',
            AuthenticationException::class => 'AUTHENTICATION_REQUIRED',
            AuthorizationException::class => 'INSUFFICIENT_PERMISSIONS',
            ModelNotFoundException::class => 'RESOURCE_NOT_FOUND',
            NotFoundHttpException::class => 'ENDPOINT_NOT_FOUND',
            MethodNotAllowedHttpException::class => 'METHOD_NOT_ALLOWED',
            TooManyRequestsHttpException::class => 'RATE_LIMIT_EXCEEDED',
        ];
        
        return $errorCodes[get_class($e)] ?? 'INTERNAL_SERVER_ERROR';
    }
    
    /**
     * Get a user-friendly error title.
     */
    protected function getErrorTitle(Throwable $e): string
    {
        $titles = [
            ValidationException::class => 'Validation Failed',
            AuthenticationException::class => 'Authentication Required',
            AuthorizationException::class => 'Access Denied',
            ModelNotFoundException::class => 'Resource Not Found',
            NotFoundHttpException::class => 'Endpoint Not Found',
            MethodNotAllowedHttpException::class => 'Method Not Allowed',
            TooManyRequestsHttpException::class => 'Too Many Requests',
        ];
        
        return $titles[get_class($e)] ?? 'Server Error';
    }
    
    /**
     * Get a detailed error message.
     */
    protected function getErrorDetail(Throwable $e): string
    {
        if ($e instanceof ValidationException) {
            return 'The given data was invalid. Please check the validation errors for details.';
        }
        
        if ($e instanceof ModelNotFoundException) {
            $model = last(explode('\\', $e->getModel()));
            return "The requested {$model} resource could not be found.";
        }
        
        if ($e instanceof HttpException) {
            return $e->getMessage() ?: 'An error occurred while processing your request.';
        }
        
        // In production, don't expose internal error details
        if (!config('app.debug')) {
            return 'An unexpected error occurred. Please try again later.';
        }
        
        return $e->getMessage();
    }
    
    /**
     * Get a helpful hint for resolving the error.
     */
    protected function getErrorHint(Throwable $e): string
    {
        $hints = [
            ValidationException::class => 'Review the validation errors and ensure all required fields are provided with valid data.',
            AuthenticationException::class => 'Please provide a valid authentication token in the Authorization header.',
            AuthorizationException::class => 'Your account does not have permission to perform this action. Contact support if you believe this is an error.',
            ModelNotFoundException::class => 'Verify the resource ID is correct and that the resource exists.',
            NotFoundHttpException::class => 'Check the API documentation for the correct endpoint URL and method.',
            MethodNotAllowedHttpException::class => 'This endpoint does not support the HTTP method used. Check the API documentation for allowed methods.',
            TooManyRequestsHttpException::class => 'You have exceeded the rate limit. Please wait before making more requests.',
        ];
        
        $defaultHint = 'If this problem persists, please contact API support at api@fuelintel.mx';
        
        return $hints[get_class($e)] ?? $defaultHint;
    }
}