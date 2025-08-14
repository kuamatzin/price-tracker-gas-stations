const got = require("got").default;
const pLimit = require("p-limit").default;
import config from "../config";

const limit = pLimit(config.scraper.rateLimit);
const minDelay = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface HttpClientOptions {
  skipRateLimit?: boolean;
}

class HttpClient {
  private client: any;
  private lastRequestTime = 0;

  constructor() {
    this.client = got.extend({
      timeout: {
        request: 30000,
      },
      retry: {
        limit: config.scraper.maxRetries,
        methods: ["GET"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
        errorCodes: [
          "ETIMEDOUT",
          "ECONNRESET",
          "EADDRINUSE",
          "ECONNREFUSED",
          "EPIPE",
          "ENOTFOUND",
          "ENETUNREACH",
          "EAI_AGAIN",
        ],
        calculateDelay: ({ attemptCount }: { attemptCount: number }) => {
          const delay = Math.min(
            config.scraper.retryDelay.base *
              Math.pow(config.scraper.retryDelay.multiplier, attemptCount - 1),
            config.scraper.retryDelay.maxDelay,
          );
          console.log(`Retry attempt ${attemptCount}, waiting ${delay}ms`);
          return delay;
        },
      },
      hooks: {
        beforeRequest: [
          (options: any) => {
            console.debug(`[HTTP] ${options.method} ${options.url}`);
          },
        ],
        afterResponse: [
          (response: any) => {
            console.debug(
              `[HTTP] Response ${response.statusCode} from ${response.url}`,
            );
            return response;
          },
        ],
        beforeRetry: [
          (error: any, retryCount: number) => {
            console.warn(
              `[HTTP] Retry ${retryCount} for ${error.options.url}: ${error.message}`,
            );
          },
        ],
      },
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < minDelay) {
      await sleep(minDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  async get<T = any>(url: string, options?: HttpClientOptions): Promise<T> {
    const { skipRateLimit } = options || {};

    if (!skipRateLimit) {
      await this.enforceRateLimit();
    }

    const executeRequest = async () => {
      const response = await this.client.get(url, {
        responseType: "json",
      });
      return response.body as T;
    };

    if (skipRateLimit) {
      return executeRequest();
    }

    return limit(executeRequest);
  }

  async post<T = any>(
    url: string,
    body?: any,
    options?: HttpClientOptions,
  ): Promise<T> {
    const { skipRateLimit } = options || {};

    if (!skipRateLimit) {
      await this.enforceRateLimit();
    }

    const executeRequest = async () => {
      const response = await this.client.post(url, {
        json: body,
        responseType: "json",
      });
      return response.body as T;
    };

    if (skipRateLimit) {
      return executeRequest();
    }

    return limit(executeRequest);
  }
}

export const httpClient = new HttpClient();
