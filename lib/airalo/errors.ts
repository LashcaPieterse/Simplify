export interface AiraloBusinessErrorInfo {
  code: number | null;
  reason: string | null;
  message: string | null;
}

export type AiraloErrorCategory =
  | "insufficient_credit"
  | "operator_maintenance"
  | "checksum_failed"
  | "topup_disabled"
  | "out_of_stock"
  | "invalid_package"
  | "bad_request"
  | "unexpected"
  | "iccid_recycled"
  | "authentication_failed"
  | "rate_limited"
  | "server_error"
  | "unknown";

export interface AiraloErrorClassification {
  status: number;
  code: number | null;
  reason: string | null;
  message: string | null;
  category: AiraloErrorCategory;
  retriable: boolean;
}

const RETRIABLE_422_CODES = new Set<number>([13, 33, 53]);
const OUT_OF_STOCK_PATTERNS = [/out of stock/i, /insufficient stock/i];
const MAINTENANCE_PATTERNS = [/maintenance/i];
const CHECKSUM_PATTERNS = [/checksum/i];
const RECYCLED_PATTERNS = [/recycled/i];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normaliseAiraloString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseAiraloNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function pickFirstNonNull<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function matchAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasPatternMatch(
  info: AiraloBusinessErrorInfo | null,
  fallback: string | null,
  patterns: RegExp[],
): boolean {
  const candidates = [info?.reason, info?.message, fallback];

  return candidates.some(
    (candidate) => typeof candidate === "string" && matchAnyPattern(candidate, patterns),
  );
}

export function extractAiraloBusinessError(body: unknown): AiraloBusinessErrorInfo | null {
  if (typeof body === "string") {
    const text = body.trim();
    return text ? { code: null, reason: text, message: text } : null;
  }

  const root = toRecord(body);
  if (!root) {
    return null;
  }

  const meta = toRecord(root.meta);
  const error = toRecord(root.error);
  const candidates = [root, meta, error].filter(
    (entry): entry is Record<string, unknown> => Boolean(entry),
  );

  const code = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloNumber(
        (entry as { code?: unknown; error_code?: unknown }).code ??
          (entry as { code?: unknown; error_code?: unknown }).error_code,
      ),
    ),
  );

  const reason = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloString(
        (entry as { reason?: unknown; error_reason?: unknown }).reason ??
          (entry as { reason?: unknown; error_reason?: unknown }).error_reason,
      ),
    ),
  );

  const message = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloString(
        (entry as { message?: unknown; error_message?: unknown }).message ??
          (entry as { message?: unknown; error_message?: unknown }).error_message,
      ),
    ),
  );

  if (code === null && !reason && !message) {
    return null;
  }

  return { code, reason, message };
}

function classify422Error(
  code: number | null,
  info: AiraloBusinessErrorInfo | null,
  fallback: string | null,
): Pick<AiraloErrorClassification, "category" | "retriable"> {
  switch (code) {
    case 11:
      return { category: "insufficient_credit", retriable: false };
    case 13:
      return { category: "operator_maintenance", retriable: true };
    case 14:
      return { category: "checksum_failed", retriable: false };
    case 23:
      return { category: "topup_disabled", retriable: false };
    case 33:
      return { category: "out_of_stock", retriable: true };
    case 34:
      return { category: "invalid_package", retriable: false };
    case 43:
      return { category: "bad_request", retriable: false };
    case 53:
      return { category: "unexpected", retriable: true };
    case 73:
      return { category: "iccid_recycled", retriable: false };
    default:
      break;
  }

  if (hasPatternMatch(info, fallback, OUT_OF_STOCK_PATTERNS)) {
    return { category: "out_of_stock", retriable: true };
  }

  if (hasPatternMatch(info, fallback, MAINTENANCE_PATTERNS)) {
    return { category: "operator_maintenance", retriable: true };
  }

  if (hasPatternMatch(info, fallback, CHECKSUM_PATTERNS)) {
    return { category: "checksum_failed", retriable: false };
  }

  if (hasPatternMatch(info, fallback, RECYCLED_PATTERNS)) {
    return { category: "iccid_recycled", retriable: false };
  }

  return {
    category: "bad_request",
    retriable: code !== null && RETRIABLE_422_CODES.has(code),
  };
}

export function classifyAiraloError(options: {
  status: number;
  body?: unknown;
  fallbackMessage?: string;
}): AiraloErrorClassification {
  const info = extractAiraloBusinessError(options.body);
  const fallback = normaliseAiraloString(options.fallbackMessage) ?? null;

  const classification: AiraloErrorClassification = {
    status: options.status,
    code: info?.code ?? null,
    reason: info?.reason ?? null,
    message: info?.message ?? fallback,
    category: "unknown",
    retriable: false,
  };

  if (options.status === 401) {
    classification.category = "authentication_failed";
    classification.retriable = false;
    return classification;
  }

  if (options.status === 429) {
    classification.category = "rate_limited";
    classification.retriable = true;
    return classification;
  }

  if (options.status >= 500) {
    classification.category = "server_error";
    classification.retriable = true;
    return classification;
  }

  if (options.status === 422) {
    const mapped = classify422Error(classification.code, info, fallback);
    classification.category = mapped.category;
    classification.retriable = mapped.retriable;
    return classification;
  }

  if (options.status >= 400) {
    classification.category = "bad_request";
  }

  return classification;
}

export function isRetriableAiraloResponse(options: {
  status: number;
  body?: unknown;
  fallbackMessage?: string;
}): boolean {
  return classifyAiraloError(options).retriable;
}
