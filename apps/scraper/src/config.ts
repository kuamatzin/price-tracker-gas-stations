import dotenv from "dotenv";

dotenv.config();

export const config = {
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://user:pass@localhost:5432/fuelintel",
    poolMin: 2,
    poolMax: 10,
  },
  api: {
    catalogBase: "https://api-catalogo.cne.gob.mx/api/utiles",
    pricingBase: "https://api-reportediario.cne.gob.mx/api/EstacionServicio",
  },
  scraper: {
    maxRetries: parseInt(process.env.MAX_RETRIES || "5", 10),
    rateLimit: parseInt(process.env.RATE_LIMIT || "10", 10),
    retryDelay: {
      base: 1000,
      multiplier: 2,
      maxDelay: 30000,
    },
    circuitBreaker: {
      failureThreshold: 10,
      cooldownPeriod: 5 * 60 * 1000,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || "",
  },
  environment: process.env.NODE_ENV || "development",
  dryRun: process.env.DRY_RUN === "true",
};
