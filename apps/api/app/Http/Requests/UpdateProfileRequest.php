<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
            ],
            'telegram_chat_id' => [
                'nullable',
                'string',
                'max:255',
            ],
            'password' => [
                'sometimes',
                'string',
                'min:8',
                'regex:/[A-Z]/',      // must contain uppercase
                'regex:/[0-9]/',      // must contain number
                'confirmed',          // must match password_confirmation
            ],
            'station_numero' => [
                'sometimes',
                'string',
                'exists:stations,numero',
            ],
            'notification_preferences' => [
                'sometimes',
                'array',
            ],
            'notification_preferences.email' => [
                'boolean',
            ],
            'notification_preferences.telegram' => [
                'boolean',
            ],
        ];
    }

    /**
     * Get custom error messages.
     */
    public function messages(): array
    {
        return [
            'password.regex' => 'La contraseña debe contener al menos una letra mayúscula y un número.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'station_numero.exists' => 'La estación seleccionada no existe.',
        ];
    }
}
