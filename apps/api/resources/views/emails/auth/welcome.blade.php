<x-mail::message>
# ¡Bienvenido a FuelIntel!

Hola {{ $user->name }},

Gracias por registrarte en FuelIntel. Tu cuenta ha sido creada exitosamente.

@if($user->station)
## Tu Estación Asignada
- **Número**: {{ $user->station->numero }}
- **Nombre**: {{ $user->station->nombre }}
- **Ubicación**: {{ $user->station->municipio?->nombre }}, {{ $user->station->municipio?->entidad?->nombre }}
@endif

## Tu Plan Actual
**{{ ucfirst($user->subscription_tier) }}** - {{ $user->api_rate_limit }} solicitudes por hora

<x-mail::button :url="config('app.frontend_url') . '/dashboard'">
Ir al Dashboard
</x-mail::button>

Si tienes alguna pregunta, no dudes en contactarnos.

Saludos,<br>
{{ config('app.name') }}
</x-mail::message>