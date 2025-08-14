<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Validator;

class ValidationServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Custom validation rule for fuel type
        Validator::extend('fuel_type', function ($attribute, $value, $parameters, $validator) {
            return in_array($value, ['regular', 'premium', 'diesel']);
        }, 'The :attribute must be a valid fuel type (regular, premium, or diesel).');
        
        // Custom validation rule for Mexican postal code
        Validator::extend('mx_postal_code', function ($attribute, $value, $parameters, $validator) {
            return preg_match('/^[0-9]{5}$/', $value);
        }, 'The :attribute must be a valid 5-digit Mexican postal code.');
        
        // Custom validation rule for coordinates
        Validator::extend('latitude', function ($attribute, $value, $parameters, $validator) {
            return is_numeric($value) && $value >= -90 && $value <= 90;
        }, 'The :attribute must be a valid latitude between -90 and 90.');
        
        Validator::extend('longitude', function ($attribute, $value, $parameters, $validator) {
            return is_numeric($value) && $value >= -180 && $value <= 180;
        }, 'The :attribute must be a valid longitude between -180 and 180.');
        
        // Custom validation rule for price
        Validator::extend('price', function ($attribute, $value, $parameters, $validator) {
            return is_numeric($value) && $value > 0 && $value < 100;
        }, 'The :attribute must be a valid price between 0 and 100.');
    }
}