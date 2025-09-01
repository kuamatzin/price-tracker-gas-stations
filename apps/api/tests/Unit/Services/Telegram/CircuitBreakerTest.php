<?php

namespace Tests\Unit\Services\Telegram;

use App\Services\Telegram\CircuitBreaker;
use App\Services\Telegram\CircuitBreakerState;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CircuitBreakerTest extends TestCase
{
    protected CircuitBreaker $circuitBreaker;

    protected function setUp(): void
    {
        parent::setUp();

        // Clear cache before each test
        Cache::flush();

        // Create circuit breaker with low thresholds for testing
        $this->circuitBreaker = new CircuitBreaker(
            'test_service',
            3, // failure threshold
            1000, // 1 second cooldown
            2  // success threshold
        );
    }

    public function test_circuit_breaker_starts_closed()
    {
        $this->assertEquals(CircuitBreakerState::CLOSED, $this->circuitBreaker->getState());
        $this->assertTrue($this->circuitBreaker->canAttempt());
    }

    public function test_circuit_breaker_opens_after_threshold_failures()
    {
        // Cause 3 failures
        for ($i = 0; $i < 3; $i++) {
            try {
                $this->circuitBreaker->execute(function () {
                    throw new \Exception('Test failure');
                });
            } catch (\Exception $e) {
                // Expected
            }
        }

        $this->assertEquals(CircuitBreakerState::OPEN, $this->circuitBreaker->getState());
        $this->assertFalse($this->circuitBreaker->canAttempt());
    }

    public function test_circuit_breaker_rejects_calls_when_open()
    {
        // Force circuit breaker to open
        $this->circuitBreaker->forceOpen();

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/Circuit breaker.*is OPEN/');

        $this->circuitBreaker->execute(function () {
            return 'should not execute';
        });
    }

    public function test_circuit_breaker_transitions_to_half_open_after_cooldown()
    {
        // Force open and wait for cooldown
        $this->circuitBreaker->forceOpen();
        sleep(2); // Wait longer than 1 second cooldown

        $this->assertEquals(CircuitBreakerState::HALF_OPEN, $this->circuitBreaker->getState());
        $this->assertTrue($this->circuitBreaker->canAttempt());
    }

    public function test_circuit_breaker_closes_after_success_threshold()
    {
        // Force to half-open state
        $this->circuitBreaker->forceOpen();
        sleep(2);

        $this->assertEquals(CircuitBreakerState::HALF_OPEN, $this->circuitBreaker->getState());

        // Execute 2 successful calls (success threshold)
        for ($i = 0; $i < 2; $i++) {
            $result = $this->circuitBreaker->execute(function () {
                return 'success';
            });
            $this->assertEquals('success', $result);
        }

        $this->assertEquals(CircuitBreakerState::CLOSED, $this->circuitBreaker->getState());
    }

    public function test_circuit_breaker_stats()
    {
        $stats = $this->circuitBreaker->getStats();

        $this->assertArrayHasKey('name', $stats);
        $this->assertArrayHasKey('state', $stats);
        $this->assertArrayHasKey('failures', $stats);
        $this->assertArrayHasKey('successes', $stats);
        $this->assertArrayHasKey('canAttempt', $stats);
        $this->assertArrayHasKey('failureThreshold', $stats);
        $this->assertArrayHasKey('cooldownPeriod', $stats);

        $this->assertEquals('test_service', $stats['name']);
        $this->assertEquals('CLOSED', $stats['state']);
        $this->assertEquals(3, $stats['failureThreshold']);
    }

    public function test_circuit_breaker_health_status()
    {
        // Test healthy state
        $this->assertEquals('healthy', $this->circuitBreaker->getHealthStatus());

        // Force to half-open
        $this->circuitBreaker->forceOpen();
        sleep(2);
        $this->assertEquals('degraded', $this->circuitBreaker->getHealthStatus());

        // Force to open
        $this->circuitBreaker->forceOpen();
        $this->assertEquals('unhealthy', $this->circuitBreaker->getHealthStatus());
    }

    public function test_circuit_breaker_reset()
    {
        // Cause failures and open circuit
        for ($i = 0; $i < 3; $i++) {
            try {
                $this->circuitBreaker->execute(function () {
                    throw new \Exception('Test failure');
                });
            } catch (\Exception $e) {
                // Expected
            }
        }

        $this->assertEquals(CircuitBreakerState::OPEN, $this->circuitBreaker->getState());

        // Reset circuit breaker
        $this->circuitBreaker->reset();

        $this->assertEquals(CircuitBreakerState::CLOSED, $this->circuitBreaker->getState());
        $this->assertTrue($this->circuitBreaker->canAttempt());

        $stats = $this->circuitBreaker->getStats();
        $this->assertEquals(0, $stats['failures']);
        $this->assertEquals(0, $stats['successes']);
    }

    public function test_deepseek_circuit_breaker_factory()
    {
        $breaker = CircuitBreaker::createForDeepSeek();

        $stats = $breaker->getStats();
        $this->assertEquals('deepseek', $stats['name']);
        $this->assertEquals(5, $stats['failureThreshold']); // Default from config
    }

    public function test_laravel_api_circuit_breaker_factory()
    {
        $breaker = CircuitBreaker::createForLaravelApi();

        $stats = $breaker->getStats();
        $this->assertEquals('laravel_api', $stats['name']);
        $this->assertEquals(3, $stats['failureThreshold']); // Default from config
    }
}
