<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed locations first (estados and municipios)
        $this->call([
            LocationSeeder::class,
        ]);

        // Note: Station data should be imported from external source
        // or use a separate StationSeeder with real data
        
        // Seed test users with multi-station support
        $this->call([
            MultiStationSeeder::class,
        ]);

        $this->command->info('Database seeding completed!');
    }
}
