<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class RunScraperCommand extends Command
{
    protected $signature = 'scraper:run {--dry-run : Run in dry-run mode without database writes}';

    protected $description = 'Execute the Node.js government API scraper';

    public function handle(): int
    {
        $this->info('Starting government API scraper...');
        Log::info('Scraper execution started', ['time' => now()->toIso8601String()]);

        $scraperRunId = $this->createScraperRun();

        try {
            $command = $this->buildCommand();
            $this->info("Executing: $command");

            $process = Process::fromShellCommandline($command);
            $process->setWorkingDirectory(base_path('../scraper'));
            $process->setTimeout(config('scraper.timeout', 3600));

            $process->run(function ($type, $buffer) {
                if ($type === Process::ERR) {
                    $this->error($buffer);
                    Log::error('Scraper error output', ['output' => $buffer]);
                } else {
                    $this->line($buffer);
                    Log::debug('Scraper output', ['output' => $buffer]);
                }
            });

            if (! $process->isSuccessful()) {
                throw new ProcessFailedException($process);
            }

            $this->updateScraperRun($scraperRunId, 'completed', $process->getOutput());

            $this->info('Scraper completed successfully!');
            Log::info('Scraper execution completed', [
                'time' => now()->toIso8601String(),
                'run_id' => $scraperRunId,
            ]);

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->updateScraperRun($scraperRunId, 'failed', null, $e->getMessage());

            $this->error('Scraper failed: '.$e->getMessage());
            Log::error('Scraper execution failed', [
                'error' => $e->getMessage(),
                'run_id' => $scraperRunId,
            ]);

            return Command::FAILURE;
        }
    }

    private function buildCommand(): string
    {
        $baseCommand = 'npm run scrape';

        if ($this->option('dry-run')) {
            $baseCommand = 'DRY_RUN=true '.$baseCommand;
        }

        return $baseCommand;
    }

    private function createScraperRun(): int
    {
        return DB::table('scraper_runs')->insertGetId([
            'started_at' => now(),
            'status' => 'running',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function updateScraperRun(int $runId, string $status, ?string $output = null, ?string $error = null): void
    {
        $updateData = [
            'status' => $status,
            'updated_at' => now(),
        ];

        if ($status === 'completed') {
            $updateData['completed_at'] = now();

            // Parse output to extract statistics if available
            if ($output) {
                $stats = $this->parseScraperOutput($output);
                if ($stats) {
                    $updateData = array_merge($updateData, $stats);
                }
            }
        }

        if ($error) {
            $updateData['error_message'] = $error;
        }

        DB::table('scraper_runs')
            ->where('id', $runId)
            ->update($updateData);
    }

    private function parseScraperOutput(string $output): array
    {
        $stats = [];

        // Parse statistics from scraper output
        if (preg_match('/Estados processed: (\d+)\/32/', $output, $matches)) {
            $stats['estados_processed'] = (int) $matches[1];
        }

        if (preg_match('/Municipios processed: (\d+)/', $output, $matches)) {
            $stats['municipios_processed'] = (int) $matches[1];
        }

        if (preg_match('/Stations found: (\d+)/', $output, $matches)) {
            $stats['stations_processed'] = (int) $matches[1];
        }

        if (preg_match('/Price changes detected: (\d+)/', $output, $matches)) {
            $stats['price_changes_detected'] = (int) $matches[1];
        }

        if (preg_match('/New stations added: (\d+)/', $output, $matches)) {
            $stats['new_stations'] = (int) $matches[1];
        }

        return $stats;
    }
}
