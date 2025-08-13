import dotenv from "dotenv";

dotenv.config();

export const config = {
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://fuelintel:fuelintel_dev_2024@localhost:5432/fuelintel",
  },
  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:8000",
    scraperKey: process.env.SCRAPER_API_KEY || "",
  },
  scraper: {
    intervalMinutes: parseInt(process.env.SCRAPER_INTERVAL_MINUTES || "30", 10),
    batchSize: parseInt(process.env.SCRAPER_BATCH_SIZE || "100", 10),
    retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || "3", 10),
    timeout: parseInt(process.env.SCRAPER_TIMEOUT || "30000", 10),
  },
  government: {
    pricesUrl:
      process.env.GOV_PRICES_URL ||
      "https://api.datos.gob.mx/v1/precio.gasolina",
    stationsUrl:
      process.env.GOV_STATIONS_URL ||
      "https://api.datos.gob.mx/v1/estaciones.servicio",
  },
  environment: process.env.NODE_ENV || "development",
};
