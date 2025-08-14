<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class BaseApiController extends Controller
{
    protected function successResponse($data, string $message = 'Success', int $code = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }
    
    protected function errorResponse(string $message, int $code = 400, $errors = null): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];
        
        if ($errors !== null) {
            $response['errors'] = $errors;
        }
        
        return response()->json($response, $code);
    }
    
    protected function paginatedResponse($paginator, string $message = 'Success'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $paginator->items(),
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }
    
    protected function noContentResponse(): JsonResponse
    {
        return response()->json(null, 204);
    }
    
    protected function createdResponse($data, string $message = 'Created successfully'): JsonResponse
    {
        return $this->successResponse($data, $message, 201);
    }
    
    protected function unauthorizedResponse(string $message = 'Unauthorized'): JsonResponse
    {
        return $this->errorResponse($message, 401);
    }
    
    protected function forbiddenResponse(string $message = 'Forbidden'): JsonResponse
    {
        return $this->errorResponse($message, 403);
    }
    
    protected function notFoundResponse(string $message = 'Resource not found'): JsonResponse
    {
        return $this->errorResponse($message, 404);
    }
    
    protected function validationErrorResponse($errors, string $message = 'Validation failed'): JsonResponse
    {
        return $this->errorResponse($message, 422, $errors);
    }
}