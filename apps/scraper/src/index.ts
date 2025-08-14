import config from "./config";
import { orchestrator } from "./orchestrator";
import { logger } from "./utils/logger";
import { monitoringServer } from "./monitoring/server";

async function main() {
  logger.info("FuelIntel Scraper Starting...", {
    environment: config.environment,
    dryRun: config.dryRun,
  });

  monitoringServer.start();

  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, stopping scraper...");
    orchestrator.stop();
    await monitoringServer.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, stopping scraper...");
    orchestrator.stop();
    await monitoringServer.stop();
    process.exit(0);
  });

  try {
    await orchestrator.run({
      dryRun: config.dryRun,
    });

    logger.info("Scraping completed successfully");
    await monitoringServer.stop();
    process.exit(0);
  } catch (error) {
    logger.error("Scraping failed", { error });
    await monitoringServer.stop();
    process.exit(1);
  }
}

main().catch(async (error) => {
  logger.error("Fatal error", { error });
  await monitoringServer.stop();
  process.exit(1);
});
