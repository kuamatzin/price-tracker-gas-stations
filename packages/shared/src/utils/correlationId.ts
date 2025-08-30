import { v4 as uuidv4 } from "uuid";

export function generateCorrelationId(): string {
  return uuidv4();
}

export function getCorrelationId(headers: Record<string, any>): string {
  return (
    headers["x-correlation-id"] ||
    headers["X-Correlation-Id"] ||
    generateCorrelationId()
  );
}

export const CORRELATION_ID_HEADER = "X-Correlation-Id";
