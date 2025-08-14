<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class DocumentationController extends Controller
{
    public function index(): Response
    {
        $html = <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FuelIntel API Documentation</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "/api-docs.json",
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>
HTML;

        return response($html)->header('Content-Type', 'text/html');
    }
}