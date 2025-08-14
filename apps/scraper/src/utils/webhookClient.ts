import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { logger } from "./logger";
import config from "../config";

interface WebhookPayload {
  started_at: string;
  completed_at: string;
  status: "completed" | "failed";
  statistics: {
    estados_processed: number;
    municipios_processed: number;
    stations_found: number;
    price_changes_detected: number;
    new_stations_added: number;
    errors_encountered: number;
  };
  errors?: Array<{
    type: string;
    endpoint?: string;
    message: string;
    estado_id?: number;
  }>;
}

class WebhookClient {
  private webhookUrl: string;
  private webhookSecret: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Start with 1 second

  constructor() {
    this.webhookUrl = config.webhook.url;
    this.webhookSecret = config.webhook.secret;

    if (!this.webhookUrl || !this.webhookSecret) {
      logger.warn(
        "Webhook configuration incomplete - webhook notifications disabled",
      );
    }
  }

  /**
   * Generate HMAC-SHA256 signature for payload
   */
  private generateSignature(payload: string): string {
    return (
      "sha256=" +
      crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex")
    );
  }

  /**
   * Send completion webhook to Laravel
   */
  async sendCompletionWebhook(payload: WebhookPayload): Promise<void> {
    if (!this.webhookUrl || !this.webhookSecret) {
      logger.warn("Webhook not configured, skipping notification");
      return;
    }

    const jsonPayload = JSON.stringify(payload);
    const signature = this.generateSignature(jsonPayload);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`Sending webhook (attempt ${attempt}/${this.maxRetries})`, {
          url: this.webhookUrl,
          status: payload.status,
        });

        const response = await axios.post(this.webhookUrl, payload, {
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
          },
          timeout: 30000, // 30 second timeout
        });

        logger.info("Webhook sent successfully", {
          status: response.status,
          data: response.data,
        });

        return; // Success, exit the retry loop
      } catch (error) {
        const axiosError = error as AxiosError;

        logger.error(`Webhook failed (attempt ${attempt}/${this.maxRetries})`, {
          error: axiosError.message,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        // Don't retry on authentication errors
        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          logger.error("Webhook authentication failed - check webhook secret");
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === this.maxRetries) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying webhook in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Build webhook payload from scraper statistics
   */
  buildPayload(
    startedAt: Date,
    completedAt: Date,
    status: "completed" | "failed",
    statistics: any,
    errors: any[] = [],
  ): WebhookPayload {
    return {
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      status,
      statistics: {
        estados_processed: statistics.estadosProcessed || 0,
        municipios_processed: statistics.municipiosProcessed || 0,
        stations_found: statistics.stationsFound || 0,
        price_changes_detected: statistics.priceChangesDetected || 0,
        new_stations_added: statistics.newStationsAdded || 0,
        errors_encountered: statistics.errorsEncountered || 0,
      },
      errors: errors.map((err) => ({
        type: err.type || "UNKNOWN",
        endpoint: err.endpoint,
        message: err.message || "Unknown error",
        estado_id: err.estadoId,
      })),
    };
  }
}

export const webhookClient = new WebhookClient();
