import express, { Request, Response } from "express";
import { orchestrator } from "../orchestrator";
import { scraperLogger } from "../utils/logger";
import { circuitBreaker } from "../utils/circuitBreaker";
import { testConnection } from "../db/connection";
import { governmentAPI } from "../scrapers/governmentApi";

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor(port: number = 9090) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get("/health", async (req: Request, res: Response) => {
      const health = await this.getHealthStatus();
      const statusCode = health.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(health);
    });

    this.app.get("/metrics", (req: Request, res: Response) => {
      const metrics = this.getPrometheusMetrics();
      res.set("Content-Type", "text/plain; version=0.0.4");
      res.send(metrics);
    });

    this.app.get("/metrics.json", (req: Request, res: Response) => {
      const metrics = this.getMetrics();
      res.json(metrics);
    });

    this.app.get("/status", (req: Request, res: Response) => {
      const status = orchestrator.getStatus();
      res.json(status);
    });
  }

  private async getHealthStatus() {
    const checks = {
      database: false,
      governmentAPI: false,
      circuitBreaker: circuitBreaker.getState() !== "OPEN",
    };

    try {
      checks.database = await testConnection();
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    try {
      checks.governmentAPI = await governmentAPI.testConnection();
    } catch (error) {
      console.error("Government API health check failed:", error);
    }

    const allHealthy = Object.values(checks).every((check) => check === true);

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
    };
  }

  private getMetrics() {
    const scraperStats = scraperLogger.getStats();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      scraper: {
        ...scraperStats,
        isRunning: orchestrator.isScrapingActive(),
      },
      circuitBreaker: circuitBreaker.getStats(),
      system: {
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpu: {
          user: Math.round(cpuUsage.user / 1000),
          system: Math.round(cpuUsage.system / 1000),
        },
        uptime: Math.round(process.uptime()),
      },
    };
  }

  private getPrometheusMetrics(): string {
    const stats = scraperLogger.getStats();
    const cbStats = circuitBreaker.getStats();
    const memoryUsage = process.memoryUsage();

    const metrics: string[] = [];

    // Scraper runs
    metrics.push("# HELP scraper_runs_total Total number of scraper runs");
    metrics.push("# TYPE scraper_runs_total counter");
    metrics.push(`scraper_runs_total{status="completed"} 0`);
    metrics.push(
      `scraper_runs_total{status="failed"} ${stats.errors?.length || 0}`,
    );
    metrics.push("");

    // Scraper duration
    metrics.push("# HELP scraper_duration_seconds Scraper execution duration");
    metrics.push("# TYPE scraper_duration_seconds gauge");
    metrics.push(`scraper_duration_seconds 0`);
    metrics.push("");

    // Price changes
    metrics.push(
      "# HELP scraper_price_changes_total Total price changes detected",
    );
    metrics.push("# TYPE scraper_price_changes_total counter");
    metrics.push(
      `scraper_price_changes_total ${stats.priceChangesDetected || 0}`,
    );
    metrics.push("");

    // New stations
    metrics.push("# HELP scraper_new_stations_total Total new stations added");
    metrics.push("# TYPE scraper_new_stations_total counter");
    metrics.push(`scraper_new_stations_total ${stats.newStationsAdded || 0}`);
    metrics.push("");

    // Estados processed
    metrics.push("# HELP scraper_estados_processed Total estados processed");
    metrics.push("# TYPE scraper_estados_processed counter");
    metrics.push(`scraper_estados_processed ${stats.estadosProcessed || 0}`);
    metrics.push("");

    // Municipios processed
    metrics.push(
      "# HELP scraper_municipios_processed Total municipios processed",
    );
    metrics.push("# TYPE scraper_municipios_processed counter");
    metrics.push(
      `scraper_municipios_processed ${stats.municipiosProcessed || 0}`,
    );
    metrics.push("");

    // Circuit breaker
    metrics.push("# HELP circuit_breaker_state Circuit breaker current state");
    metrics.push("# TYPE circuit_breaker_state gauge");
    metrics.push(`circuit_breaker_state{state="${cbStats.state}"} 1`);
    metrics.push("");

    metrics.push(
      "# HELP circuit_breaker_failures_total Total circuit breaker failures",
    );
    metrics.push("# TYPE circuit_breaker_failures_total counter");
    metrics.push(`circuit_breaker_failures_total ${cbStats.failures || 0}`);
    metrics.push("");

    // Database pool (placeholder - would need actual pool stats)
    metrics.push("# HELP database_pool_active Active database connections");
    metrics.push("# TYPE database_pool_active gauge");
    metrics.push(`database_pool_active 0`);
    metrics.push("");

    // Memory usage
    metrics.push(
      "# HELP nodejs_heap_size_used_bytes Process heap size from Node.js",
    );
    metrics.push("# TYPE nodejs_heap_size_used_bytes gauge");
    metrics.push(`nodejs_heap_size_used_bytes ${memoryUsage.heapUsed}`);
    metrics.push("");

    metrics.push(
      "# HELP nodejs_heap_size_total_bytes Process heap size from Node.js",
    );
    metrics.push("# TYPE nodejs_heap_size_total_bytes gauge");
    metrics.push(`nodejs_heap_size_total_bytes ${memoryUsage.heapTotal}`);
    metrics.push("");

    // Process uptime
    metrics.push("# HELP process_uptime_seconds Process uptime");
    metrics.push("# TYPE process_uptime_seconds gauge");
    metrics.push(`process_uptime_seconds ${process.uptime()}`);

    return metrics.join("\n");
  }

  start(): void {
    this.server = this.app.listen(this.port, () => {
      console.log(`Monitoring server listening on port ${this.port}`);
      console.log(`Health endpoint: http://localhost:${this.port}/health`);
      console.log(`Metrics endpoint: http://localhost:${this.port}/metrics`);
      console.log(`Status endpoint: http://localhost:${this.port}/status`);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("Monitoring server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const monitoringServer = new MonitoringServer();
