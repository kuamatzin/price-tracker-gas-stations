<x-mail::message>
# Restablecer Contraseña

Hola {{ $user->name }},

Recibimos una solicitud para restablecer la contraseña de tu cuenta.

<x-mail::button :url="config('app.frontend_url') . '/reset-password?token=' . $token . '&email=' . $user->email">
Restablecer Contraseña
</x-mail::button>

Este enlace de restablecimiento de contraseña expirará en {{ $expiration }} minutos.

Si no solicitaste un restablecimiento de contraseña, no es necesario realizar ninguna acción.

Saludos,<br>
{{ config('app.name') }}
</x-mail::message>