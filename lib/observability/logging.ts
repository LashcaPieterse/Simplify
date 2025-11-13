export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, event: string, context: LogContext = {}): void {
  const payload = {
    level,
    event,
    service: "order-service",
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(line);
      }
      break;
    case "info":
    default:
      console.info(line);
      break;
  }
}

export function logOrderInfo(event: string, context: LogContext = {}): void {
  log("info", event, context);
}

export function logOrderError(event: string, context: LogContext = {}): void {
  log("error", event, context);
}

export function logOrderWarn(event: string, context: LogContext = {}): void {
  log("warn", event, context);
}
