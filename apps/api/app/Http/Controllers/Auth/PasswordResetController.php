<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordResetController extends Controller
{
    /**
     * Send password reset link.
     */
    public function sendReset(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ], [
            'email.exists' => 'No encontramos una cuenta con ese correo electrónico.',
        ]);

        $user = User::where('email', $request->email)->first();

        // Delete any existing reset tokens for this user
        DB::table('password_resets')->where('email', $request->email)->delete();

        // Generate new reset token
        $token = Str::random(64);

        // Store token in database
        DB::table('password_resets')->insert([
            'email' => $request->email,
            'token' => Hash::make($token),
            'created_at' => now(),
        ]);

        // Send reset email
        Mail::to($user->email)->queue(new ResetPasswordMail($token, $user));

        return response()->json([
            'message' => 'Te hemos enviado un enlace para restablecer tu contraseña.',
        ], 200);
    }

    /**
     * Reset password with token.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'token' => 'required|string',
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/[A-Z]/',      // must contain uppercase
                'regex:/[0-9]/',      // must contain number
                'confirmed',          // must match password_confirmation
            ],
        ]);

        // Check if token exists and is valid
        $passwordReset = DB::table('password_resets')
            ->where('email', $request->email)
            ->first();

        if (! $passwordReset || ! Hash::check($request->token, $passwordReset->token)) {
            return response()->json([
                'message' => 'El token de restablecimiento es inválido o ha expirado.',
            ], 400);
        }

        // Check if token has expired (60 minutes)
        if (now()->diffInMinutes($passwordReset->created_at) > 60) {
            DB::table('password_resets')->where('email', $request->email)->delete();

            return response()->json([
                'message' => 'El token de restablecimiento ha expirado.',
            ], 400);
        }

        // Update user password
        $user = User::where('email', $request->email)->first();
        $user->password = Hash::make($request->password);
        $user->save();

        // Revoke all existing tokens for security
        $user->tokens()->delete();

        // Delete the used reset token
        DB::table('password_resets')->where('email', $request->email)->delete();

        return response()->json([
            'message' => 'Tu contraseña ha sido restablecida exitosamente.',
        ], 200);
    }
}
