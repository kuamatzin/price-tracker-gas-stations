<?php

namespace App\Console\Commands;

use App\Jobs\SendDailySummaryJob;
use App\Repositories\UserPreferenceRepository;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendDailySummariesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:send-summaries';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send daily summaries to users based on their configured time';

    private UserPreferenceRepository $preferenceRepo;

    /**
     * Create a new command instance.
     */
    public function __construct(UserPreferenceRepository $preferenceRepo)
    {
        parent::__construct();
        $this->preferenceRepo = $preferenceRepo;
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $startTime = now();
        $this->info('Starting daily summary dispatch...');

        // Get current time in Mexico City timezone
        $currentTime = Carbon::now('America/Mexico_City');
        $currentTimeString = $currentTime->format('H:i');

        $this->info("Current time in Mexico City: {$currentTimeString}");

        // Get users who should receive summary at this time
        $users = $this->preferenceRepo->getUsersByNotificationTime($currentTimeString);

        if ($users->isEmpty()) {
            $this->info('No users scheduled for this time.');

            return Command::SUCCESS;
        }

        $this->info("Found {$users->count()} users to notify.");

        $dispatched = 0;
        $skipped = 0;

        foreach ($users as $user) {
            try {
                // Check if user has telegram chat ID
                if (! $user->telegram_chat_id) {
                    $this->warn("User {$user->id} has no telegram chat ID, skipping.");
                    $skipped++;

                    continue;
                }

                // Check if daily summary is enabled
                $preferences = $user->notification_preferences ?? [];
                if (! ($preferences['daily_summary_enabled'] ?? true)) {
                    $this->info("User {$user->id} has daily summary disabled, skipping.");
                    $skipped++;

                    continue;
                }

                // Check if user is in silence period
                if (isset($preferences['silence_until'])) {
                    $silenceUntil = Carbon::parse($preferences['silence_until']);
                    if ($silenceUntil->isFuture()) {
                        $this->info("User {$user->id} is in silence period until {$silenceUntil}, skipping.");
                        $skipped++;

                        continue;
                    }
                }

                // Dispatch job
                SendDailySummaryJob::dispatch($user->id);
                $dispatched++;

                $this->info("Dispatched summary for user {$user->id}");

            } catch (\Exception $e) {
                $this->error("Failed to dispatch summary for user {$user->id}: {$e->getMessage()}");
                Log::error('Failed to dispatch daily summary', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $duration = now()->diffInSeconds($startTime);

        $this->info('Summary dispatch completed!');
        $this->info("Dispatched: {$dispatched}");
        $this->info("Skipped: {$skipped}");
        $this->info("Duration: {$duration} seconds");

        // Log summary
        Log::info('Daily summaries dispatch completed', [
            'time' => $currentTimeString,
            'total_users' => $users->count(),
            'dispatched' => $dispatched,
            'skipped' => $skipped,
            'duration_seconds' => $duration,
        ]);

        return Command::SUCCESS;
    }
}
