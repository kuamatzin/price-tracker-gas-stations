import config from "./config";
import { retryConnection, closePool } from "./db/connection";
import { batchUpsertStations, batchInsertPriceChanges } from "./db/queries";
import { estadosScraper } from "./scrapers/estados";
import { municipiosScraper } from "./scrapers/municipios";
import { pricesScraper } from "./scrapers/prices";
import { DataParser } from "./scrapers/dataParser";
import { changeDetector } from "./scrapers/changeDetector";
import { circuitBreaker } from "./utils/circuitBreaker";
import { scraperLogger, logger } from "./utils/logger";
import { webhookClient } from "./utils/webhookClient";

export interface OrchestratorOptions {
  dryRun?: boolean;
  maxEstados?: number;
  maxMunicipiosPerEstado?: number;
}

export class ScraperOrchestrator {
  private isRunning = false;
  private shouldStop = false;
  private startedAt: Date | null = null;
  private errors: any[] = [];

  async run(options: OrchestratorOptions = {}): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scraper is already running");
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.startedAt = new Date();
    this.errors = [];
    scraperLogger.startScraping();

    let status: "completed" | "failed" = "completed";

    try {
      if (!config.dryRun && !options.dryRun) {
        const connected = await retryConnection();
        if (!connected) {
          throw new Error("Failed to connect to database");
        }

        await changeDetector.loadExistingData();
      }

      await this.scrapeAll(options);

      scraperLogger.endScraping();
      logger.info(
        "Scraping completed successfully",
        scraperLogger.getSummary(),
      );
    } catch (error) {
      status = "failed";
      logger.error("Scraping failed", { error });
      scraperLogger.endScraping();
      this.errors.push({
        type: "ORCHESTRATOR_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      const completedAt = new Date();

      // Send webhook notification
      try {
        const stats = scraperLogger.getStats();
        const payload = webhookClient.buildPayload(
          this.startedAt!,
          completedAt,
          status,
          stats,
          this.errors,
        );
        await webhookClient.sendCompletionWebhook(payload);
      } catch (webhookError) {
        logger.error("Failed to send webhook", { error: webhookError });
      }

      this.isRunning = false;
      if (!config.dryRun && !options.dryRun) {
        await closePool();
      }
    }
  }

  private async scrapeAll(options: OrchestratorOptions): Promise<void> {
    const estados = await estadosScraper.fetchAll();
    const estadosToProcess = options.maxEstados
      ? estados.slice(0, options.maxEstados)
      : estados;

    logger.info(`Processing ${estadosToProcess.length} estados`);

    for (const estado of estadosToProcess) {
      if (this.shouldStop) {
        logger.info("Scraping stopped by user");
        break;
      }

      try {
        await circuitBreaker.execute(async () => {
          await this.processEstado(estado.EntidadFederativaId, options);
        });

        scraperLogger.logEstadoProcessed(estado.EntidadFederativaId, 0);
      } catch (error) {
        scraperLogger.logError(`estado/${estado.EntidadFederativaId}`, error);
        this.errors.push({
          type: "ESTADO_ERROR",
          endpoint: "municipios",
          message: error instanceof Error ? error.message : "Unknown error",
          estadoId: estado.EntidadFederativaId,
        });

        if (circuitBreaker.getState() === "OPEN") {
          logger.error("Circuit breaker is open, stopping scraper");
          break;
        }
      }

      if (estadosToProcess.indexOf(estado) % 5 === 4) {
        scraperLogger.logProgress();
      }
    }
  }

  private async processEstado(
    estadoId: number,
    options: OrchestratorOptions,
  ): Promise<void> {
    const municipios = await municipiosScraper.fetchForEstado(estadoId);
    const municipiosToProcess = options.maxMunicipiosPerEstado
      ? municipios.slice(0, options.maxMunicipiosPerEstado)
      : municipios;

    logger.info(
      `Processing ${municipiosToProcess.length} municipios for estado ${estadoId}`,
    );

    for (const municipio of municipiosToProcess) {
      if (this.shouldStop) {
        break;
      }

      try {
        await this.processMunicipio(estadoId, municipio.MunicipioId, options);
        scraperLogger.logMunicipioProcessed(municipio.MunicipioId, 0);
      } catch (error) {
        scraperLogger.logError(
          `municipio/${estadoId}/${municipio.MunicipioId}`,
          error,
        );
      }
    }
  }

  private async processMunicipio(
    estadoId: number,
    municipioId: number,
    options: OrchestratorOptions,
  ): Promise<void> {
    const stationPrices = await pricesScraper.fetchForMunicipio(
      estadoId,
      municipioId,
    );

    if (stationPrices.length === 0) {
      return;
    }

    const parsedStations = DataParser.parseStationPrices(
      stationPrices,
      estadoId,
      municipioId,
    );

    const validStations = parsedStations.filter((ps) =>
      DataParser.validateStation(ps.station),
    );

    if (validStations.length === 0) {
      return;
    }

    const changes = changeDetector.detectChanges(validStations);

    scraperLogger.logNewStations(changes.newStations.length);
    scraperLogger.logPriceChanges(changes.priceChanges.length);

    if (!config.dryRun && !options.dryRun) {
      await this.saveChanges(changes);
    } else {
      logger.info("DRY RUN: Would save", {
        newStations: changes.newStations.length,
        updatedStations: changes.updatedStations.length,
        priceChanges: changes.priceChanges.length,
      });
    }
  }

  private async saveChanges(changes: any): Promise<void> {
    try {
      const allStations = [...changes.newStations, ...changes.updatedStations];

      if (allStations.length > 0) {
        await batchUpsertStations(allStations);
        logger.debug(`Saved ${allStations.length} stations`);
      }

      if (changes.priceChanges.length > 0) {
        await batchInsertPriceChanges(changes.priceChanges);
        logger.debug(`Saved ${changes.priceChanges.length} price changes`);
      }
    } catch (error) {
      logger.error("Failed to save changes to database", { error });
      throw error;
    }
  }

  stop(): void {
    logger.info("Stopping scraper...");
    this.shouldStop = true;
  }

  isScrapingActive(): boolean {
    return this.isRunning;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      circuitBreakerState: circuitBreaker.getStats(),
      scraperStats: scraperLogger.getStats(),
    };
  }
}

export const orchestrator = new ScraperOrchestrator();
