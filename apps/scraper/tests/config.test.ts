import { config } from "../src/config";

describe("Config", () => {
  it("should have required configuration properties", () => {
    expect(config).toHaveProperty("database");
    expect(config).toHaveProperty("api");
    expect(config).toHaveProperty("scraper");
    expect(config).toHaveProperty("government");
    expect(config).toHaveProperty("environment");
  });

  it("should have valid database configuration", () => {
    expect(config.database.url).toBeDefined();
    expect(config.database.url).toContain("postgresql://");
  });

  it("should have valid scraper configuration", () => {
    expect(config.scraper.intervalMinutes).toBeGreaterThan(0);
    expect(config.scraper.batchSize).toBeGreaterThan(0);
    expect(config.scraper.retryAttempts).toBeGreaterThanOrEqual(0);
    expect(config.scraper.timeout).toBeGreaterThan(0);
  });
});
