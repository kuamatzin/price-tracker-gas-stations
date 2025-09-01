<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
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
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email',
            ],
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/[A-Z]/',      // must contain uppercase
                'regex:/[0-9]/',      // must contain number
                'confirmed',          // must match password_confirmation
            ],
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'station_numero' => [
                'nullable',
                'string',
                'exists:stations,numero',
            ],
        ];
    }

    /**
     * Get custom error messages.
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'Este correo electrónico ya está registrado.',
            'password.regex' => 'La contraseña debe contener al menos una letra mayúscula y un número.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'station_numero.exists' => 'La estación seleccionada no existe.',
        ];
    }
}
