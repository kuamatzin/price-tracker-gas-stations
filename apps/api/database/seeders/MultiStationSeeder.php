<?php

namespace Database\Seeders;

use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MultiStationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating test users with multi-station assignments...');

        // Get available stations
        $stations = Station::active()->limit(10)->get();

        if ($stations->isEmpty()) {
            $this->command->error('No active stations found. Please seed stations first.');
            return;
        }

        // Create Owner user with multiple stations
        $owner = User::firstOrCreate(
            ['email' => 'owner@fuelintel.mx'],
            [
                'name' => 'Station Owner',
                'password' => Hash::make('Password123!'),
                'subscription_tier' => 'premium',
                'api_rate_limit' => 1000,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => true,
                    'price_change_threshold' => 2.0,
                    'alert_radius_km' => 10,
                ],
            ]
        );

        // Assign 3 stations as owner
        $ownerStations = $stations->take(3);
        foreach ($ownerStations as $station) {
            $owner->stations()->syncWithoutDetaching([
                $station->numero => ['role' => 'owner']
            ]);
        }
        $this->command->info("Created owner user: {$owner->email} with {$ownerStations->count()} stations");

        // Create Manager user
        $manager = User::firstOrCreate(
            ['email' => 'manager@fuelintel.mx'],
            [
                'name' => 'Station Manager',
                'password' => Hash::make('Password123!'),
                'subscription_tier' => 'professional',
                'api_rate_limit' => 500,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => false,
                    'price_change_threshold' => 3.0,
                    'alert_radius_km' => 5,
                ],
            ]
        );

        // Assign 2 stations as manager and 1 as viewer
        if ($stations->count() >= 4) {
            $manager->stations()->syncWithoutDetaching([
                $stations[1]->numero => ['role' => 'manager'],
                $stations[3]->numero => ['role' => 'manager'],
                $stations[4]->numero => ['role' => 'viewer'],
            ]);
            $this->command->info("Created manager user: {$manager->email} with 2 manager and 1 viewer stations");
        }

        // Create Viewer user
        $viewer = User::firstOrCreate(
            ['email' => 'viewer@fuelintel.mx'],
            [
                'name' => 'Station Viewer',
                'password' => Hash::make('Password123!'),
                'subscription_tier' => 'free',
                'api_rate_limit' => 100,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => false,
                ],
            ]
        );

        // Assign 2 stations as viewer only
        if ($stations->count() >= 6) {
            $viewer->stations()->syncWithoutDetaching([
                $stations[0]->numero => ['role' => 'viewer'],
                $stations[5]->numero => ['role' => 'viewer'],
            ]);
            $this->command->info("Created viewer user: {$viewer->email} with 2 viewer stations");
        }

        // Create Multi-role user (has different roles in different stations)
        $multiRole = User::firstOrCreate(
            ['email' => 'multirole@fuelintel.mx'],
            [
                'name' => 'Multi Role User',
                'password' => Hash::make('Password123!'),
                'subscription_tier' => 'professional',
                'api_rate_limit' => 500,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => true,
                    'price_change_threshold' => 2.5,
                ],
            ]
        );

        // Assign different roles to different stations
        if ($stations->count() >= 7) {
            $multiRole->stations()->syncWithoutDetaching([
                $stations[6]->numero => ['role' => 'owner'],
                $stations[2]->numero => ['role' => 'manager'],
                $stations[1]->numero => ['role' => 'viewer'],
            ]);
            $this->command->info("Created multi-role user: {$multiRole->email} with mixed roles");
        }

        // Create Admin user (owner of all stations for testing)
        $admin = User::firstOrCreate(
            ['email' => 'admin@fuelintel.mx'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('Admin123!'),
                'subscription_tier' => 'enterprise',
                'api_rate_limit' => 10000,
                'notification_preferences' => [
                    'email' => true,
                    'telegram' => true,
                    'price_change_threshold' => 1.0,
                    'alert_radius_km' => 20,
                ],
            ]
        );

        // Assign all available stations as owner
        foreach ($stations as $station) {
            $admin->stations()->syncWithoutDetaching([
                $station->numero => ['role' => 'owner']
            ]);
        }
        $this->command->info("Created admin user: {$admin->email} with {$stations->count()} stations as owner");

        // Display summary
        $this->command->table(
            ['Email', 'Password', 'Subscription', 'Station Count', 'Primary Role'],
            [
                ['owner@fuelintel.mx', 'Password123!', 'premium', '3', 'owner'],
                ['manager@fuelintel.mx', 'Password123!', 'professional', '3', 'manager/viewer'],
                ['viewer@fuelintel.mx', 'Password123!', 'free', '2', 'viewer'],
                ['multirole@fuelintel.mx', 'Password123!', 'professional', '3', 'mixed'],
                ['admin@fuelintel.mx', 'Admin123!', 'enterprise', $stations->count(), 'owner'],
            ]
        );

        // Display station assignments
        $this->command->info("\nStation Assignments:");
        $users = User::whereIn('email', [
            'owner@fuelintel.mx',
            'manager@fuelintel.mx',
            'viewer@fuelintel.mx',
            'multirole@fuelintel.mx',
            'admin@fuelintel.mx'
        ])->with('stations')->get();

        foreach ($users as $user) {
            $this->command->info("\n{$user->email}:");
            foreach ($user->stations as $station) {
                $this->command->info("  - {$station->numero} ({$station->nombre}) - Role: {$station->pivot->role}");
            }
        }
    }
}