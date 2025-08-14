import winston from "winston";
import config from "../config";

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (config.environment !== "test") {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: fileFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  transports,
});

export class ScraperLogger {
  private startTime: number = 0;
  private stats = {
    estadosProcessed: 0,
    municipiosProcessed: 0,
    stationsFound: 0,
    priceChangesDetected: 0,
    newStationsAdded: 0,
    errors: [] as Array<{ endpoint: string; error: string; timestamp: Date }>,
  };

  startScraping(): void {
    this.startTime = Date.now();
    this.stats = {
      estadosProcessed: 0,
      municipiosProcessed: 0,
      stationsFound: 0,
      priceChangesDetected: 0,
      newStationsAdded: 0,
      errors: [],
    };
    logger.info("Scraping session started", {
      timestamp: new Date().toISOString(),
    });
  }

  endScraping(): void {
    const duration = Date.now() - this.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);

    logger.info("Scraping session completed", {
      duration: `${minutes}m ${seconds}s`,
      stats: this.stats,
    });
  }

  logEstadoProcessed(estadoId: number, municipiosCount: number): void {
    this.stats.estadosProcessed++;
    logger.info(`Estado ${estadoId} processed`, {
      municipiosCount,
      progress: `${this.stats.estadosProcessed}/32`,
    });
  }

  logMunicipioProcessed(municipioId: number, stationsCount: number): void {
    this.stats.municipiosProcessed++;
    this.stats.stationsFound += stationsCount;
    logger.debug(`Municipio ${municipioId} processed`, {
      stationsCount,
      totalMunicipios: this.stats.municipiosProcessed,
    });
  }

  logPriceChanges(count: number): void {
    this.stats.priceChangesDetected += count;
    logger.info(`Price changes detected: ${count}`, {
      total: this.stats.priceChangesDetected,
    });
  }

  logNewStations(count: number): void {
    this.stats.newStationsAdded += count;
    logger.info(`New stations added: ${count}`, {
      total: this.stats.newStationsAdded,
    });
  }

  logError(endpoint: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.stats.errors.push({
      endpoint,
      error: errorMessage,
      timestamp: new Date(),
    });
    logger.error(`API error at ${endpoint}`, {
      error: errorMessage,
      errorCount: this.stats.errors.length,
    });
  }

  logProgress(): void {
    logger.info("Scraping progress", {
      estados: `${this.stats.estadosProcessed}/32`,
      municipios: this.stats.municipiosProcessed,
      stations: this.stats.stationsFound,
      changes: this.stats.priceChangesDetected,
    });
  }

  getStats() {
    return { ...this.stats };
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    return {
      duration,
      ...this.stats,
      successRate:
        this.stats.municipiosProcessed > 0
          ? (
              ((this.stats.municipiosProcessed - this.stats.errors.length) /
                this.stats.municipiosProcessed) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }
}

export const scraperLogger = new ScraperLogger();
