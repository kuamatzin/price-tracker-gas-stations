import config from "../config";

export enum CircuitBreakerState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownPeriod?: number;
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private failureThreshold: number;
  private cooldownPeriod: number;
  private successThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold =
      options.failureThreshold ||
      config.scraper.circuitBreaker.failureThreshold;
    this.cooldownPeriod =
      options.cooldownPeriod || config.scraper.circuitBreaker.cooldownPeriod;
    this.successThreshold = options.successThreshold || 3;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.cooldownPeriod) {
        throw new Error(
          `Circuit breaker is OPEN. Will retry after cooldown period.`,
        );
      }
      this.state = CircuitBreakerState.HALF_OPEN;
      console.log("Circuit breaker entering HALF_OPEN state");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successes = 0;
        console.log("Circuit breaker is now CLOSED");
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      console.error(
        `Circuit breaker is now OPEN after ${this.failures} consecutive failures`,
      );
    }
  }

  getState(): CircuitBreakerState {
    if (
      this.state === CircuitBreakerState.OPEN &&
      Date.now() - this.lastFailureTime >= this.cooldownPeriod
    ) {
      return CircuitBreakerState.HALF_OPEN;
    }
    return this.state;
  }

  getStats() {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      canAttempt: this.canAttempt(),
    };
  }

  canAttempt(): boolean {
    const currentState = this.getState();
    return (
      currentState === CircuitBreakerState.CLOSED ||
      currentState === CircuitBreakerState.HALF_OPEN
    );
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    console.log("Circuit breaker has been reset");
  }

  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.lastFailureTime = Date.now();
    console.log("Circuit breaker forced to OPEN state");
  }

  forceClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    console.log("Circuit breaker forced to CLOSED state");
  }
}

export const circuitBreaker = new CircuitBreaker();
