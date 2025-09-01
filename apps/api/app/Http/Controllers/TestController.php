<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class TestController extends Controller
{
    public function testSentry(): JsonResponse
    {
        if (config('app.env') !== 'local') {
            return response()->json(['error' => 'Only available in local environment'], 403);
        }

        throw new \Exception('Test Sentry error capture from Laravel API');
    }
}
