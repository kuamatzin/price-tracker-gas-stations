import config from "../src/config";

describe("Config", () => {
  it("should have required configuration properties", () => {
    expect(config).toHaveProperty("database");
    expect(config).toHaveProperty("api");
    expect(config).toHaveProperty("scraper");
    expect(config).toHaveProperty("webhook");
    expect(config).toHaveProperty("environment");
  });

  it("should have valid database configuration", () => {
    expect(config.database.url).toBeDefined();
    expect(config.database.url).toContain("postgresql://");
  });

  it("should have valid scraper configuration", () => {
    expect(config.scraper.maxRetries).toBeGreaterThanOrEqual(0);
    expect(config.scraper.rateLimit).toBeGreaterThan(0);
    expect(config.scraper.retryDelay.base).toBeGreaterThan(0);
    expect(config.scraper.circuitBreaker.failureThreshold).toBeGreaterThan(0);
  });
});
