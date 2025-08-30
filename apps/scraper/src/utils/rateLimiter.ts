import pLimit from "p-limit";
import config from "../config";

export class RateLimiter {
  private limit: ReturnType<typeof pLimit>;
  private requestCount = 0;
  private startTime = Date.now();

  constructor(concurrency: number = config.scraper.rateLimit) {
    this.limit = pLimit(concurrency);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(async () => {
      this.requestCount++;
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const requestsPerSecond = this.requestCount / elapsedSeconds;

      if (requestsPerSecond > config.scraper.rateLimit) {
        const delay =
          (this.requestCount / config.scraper.rateLimit - elapsedSeconds) *
          1000;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return fn();
    });
  }

  getStats() {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    return {
      requestCount: this.requestCount,
      elapsedSeconds,
      requestsPerSecond: this.requestCount / elapsedSeconds,
    };
  }

  reset() {
    this.requestCount = 0;
    this.startTime = Date.now();
  }
}

// Only create singleton if not in test environment
export const rateLimiter =
  process.env.NODE_ENV === "test" ? null : new RateLimiter();
