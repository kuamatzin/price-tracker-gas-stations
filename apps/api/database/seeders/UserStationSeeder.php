<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserStation;
use App\Models\Station;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserStationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create a test user if it doesn't exist
        $user = User::firstOrCreate(
            ['email' => 'test@fuelintel.mx'],
            [
                'name' => 'Test User',
                'password' => Hash::make('Test123!'),
                'subscription_tier' => 'free',
                'api_rate_limit' => 100,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => false,
                ],
            ]
        );

        // Get a random station or create one if none exist
        $station = Station::first();
        
        if ($station) {
            // Create user-station association
            UserStation::firstOrCreate([
                'user_id' => $user->id,
                'station_numero' => $station->numero,
                'role' => 'owner',
            ]);

            $this->command->info("Created user-station association for user: {$user->email} with station: {$station->numero}");
        } else {
            $this->command->warn("No stations found in database. Please seed stations first.");
        }
    }
}
