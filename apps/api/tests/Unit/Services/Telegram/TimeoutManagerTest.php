<?php

namespace Tests\Unit\Services\Telegram;

use App\Services\Telegram\TimeoutException;
use App\Services\Telegram\TimeoutManager;
use Tests\TestCase;

class TimeoutManagerTest extends TestCase
{
    protected TimeoutManager $timeoutManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->timeoutManager = new TimeoutManager;
    }

    public function test_successful_execution_within_timeout()
    {
        $result = $this->timeoutManager->executeWithTimeout(
            function () {
                usleep(100000); // 100ms

                return 'success';
            },
            'default'
        );

        $this->assertEquals('success', $result);
    }

    public function test_timeout_detection()
    {
        $this->expectException(TimeoutException::class);

        $this->timeoutManager->executeWithTimeout(
            function () {
                usleep(3000000); // 3 seconds

                return 'should timeout';
            },
            'deepseek_api' // 2 second timeout
        );
    }

    public function test_retry_logic_with_exponential_backoff()
    {
        $attemptCount = 0;

        try {
            $this->timeoutManager->executeWithTimeout(
                function () use (&$attemptCount) {
                    $attemptCount++;
                    if ($attemptCount < 3) {
                        throw new \Exception('Temporary failure');
                    }

                    return 'success on retry';
                },
                'default',
                3 // max retries
            );
        } catch (\Exception $e) {
            // May fail, but should have attempted 3 times
        }

        $this->assertEquals(3, $attemptCount);
    }

    public function test_http_client_creation_with_timeout()
    {
        $client = $this->timeoutManager->createHttpClient('deepseek_api');

        $config = $client->getConfig();
        $this->assertEquals(2.0, $config['timeout']); // 2 seconds for DeepSeek
        $this->assertLessThanOrEqual(5.0, $config['connect_timeout']);
    }

    public function test_timeout_values_for_different_types()
    {
        $deepSeekTimeout = $this->timeoutManager->getTimeout('deepseek_api');
        $this->assertEquals(2000, $deepSeekTimeout);

        $priceTimeout = $this->timeoutManager->getTimeout('price_query');
        $this->assertEquals(3000, $priceTimeout);

        $analyticsTimeout = $this->timeoutManager->getTimeout('analytics');
        $this->assertEquals(5000, $analyticsTimeout);

        $webhookTimeout = $this->timeoutManager->getTimeout('webhook');
        $this->assertEquals(30000, $webhookTimeout);

        $defaultTimeout = $this->timeoutManager->getTimeout('unknown_type');
        $this->assertEquals(10000, $defaultTimeout);
    }

    public function test_spanish_timeout_messages()
    {
        $deepSeekMessage = $this->timeoutManager->getTimeoutMessage('deepseek_api');
        $this->assertStringContainsString('tardó demasiado', $deepSeekMessage);
        $this->assertStringContainsString('Intenta de nuevo', $deepSeekMessage);

        $priceMessage = $this->timeoutManager->getTimeoutMessage('price_query');
        $this->assertStringContainsString('tardó demasiado', $priceMessage);

        $defaultMessage = $this->timeoutManager->getTimeoutMessage('unknown');
        $this->assertStringContainsString('Por favor, intenta de nuevo', $defaultMessage);
    }

    public function test_timeout_stats()
    {
        $stats = $this->timeoutManager->getTimeoutStats();

        $this->assertArrayHasKey('configured_timeouts', $stats);
        $this->assertArrayHasKey('max_retries', $stats);
        $this->assertArrayHasKey('backoff_multipliers', $stats);

        $this->assertEquals(3, $stats['max_retries']);
        $this->assertIsArray($stats['backoff_multipliers']);
    }

    public function test_all_timeout_configurations()
    {
        $allTimeouts = $this->timeoutManager->getAllTimeouts();

        $expectedTypes = ['deepseek_api', 'price_query', 'analytics', 'webhook', 'default'];

        foreach ($expectedTypes as $type) {
            $this->assertArrayHasKey($type, $allTimeouts);
            $this->assertIsInt($allTimeouts[$type]);
            $this->assertGreaterThan(0, $allTimeouts[$type]);
        }
    }
}
