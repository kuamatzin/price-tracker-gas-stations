import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import config from "./config";
import { orchestrator } from "./orchestrator";
import { logger } from "./utils/logger";
import { monitoringServer } from "./monitoring/server";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  Sentry.captureException(reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error });
  Sentry.captureException(error);
  process.exit(1);
});

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
