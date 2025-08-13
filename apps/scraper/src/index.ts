import { config } from "./config";

async function main() {
  console.log("FuelIntel Scraper Starting...");
  console.log("Environment:", config.environment);
  console.log("Database URL:", config.database.url);

  // TODO: Initialize database connection
  // TODO: Start scraping jobs

  console.log("Scraper initialized successfully");
}

main().catch(console.error);
