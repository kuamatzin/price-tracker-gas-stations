<?php

namespace App\Console\Commands;

use App\Models\ApiToken;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class GenerateApiToken extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'api:token:generate 
                            {name : The name of the token}
                            {--abilities=* : Comma-separated list of abilities}
                            {--expires= : Number of days until expiration (leave empty for no expiration)}
                            {--service : Create a service token (no expiration)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate a new API token';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = $this->argument('name');
        $abilities = $this->option('abilities');
        $expires = $this->option('expires');
        $isService = $this->option('service');

        // Parse abilities
        if ($abilities !== '*') {
            $abilities = array_map('trim', explode(',', $abilities));
        } else {
            $abilities = ['*'];
        }

        // Generate the plain token
        $plainToken = Str::random(60);

        // Create the token record
        $apiToken = ApiToken::create([
            'name' => $name,
            'token' => hash('sha256', $plainToken),
            'abilities' => $abilities,
            'expires_at' => $isService ? null : ($expires ? now()->addDays($expires) : null),
        ]);

        $this->info('API Token created successfully!');
        $this->newLine();
        $this->line('Token Name: ' . $name);
        $this->line('Token ID: ' . $apiToken->id);
        $this->line('Abilities: ' . implode(', ', $abilities));
        
        if ($apiToken->expires_at) {
            $this->line('Expires: ' . $apiToken->expires_at->format('Y-m-d H:i:s'));
        } else {
            $this->line('Expires: Never');
        }

        $this->newLine();
        $this->warn('Plain Token (save this, it won\'t be shown again):');
        $this->line($plainToken);
        $this->newLine();

        if ($name === 'scraper-service') {
            $this->info('Add this to your scraper .env file:');
            $this->line('API_TOKEN=' . $plainToken);
        }

        return Command::SUCCESS;
    }
}