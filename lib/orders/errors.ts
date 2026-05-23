import { z } from "zod";

import { AiraloError } from "../airalo/client";
import {
  classifyAiraloError,
  extractAiraloBusinessError,
  type AiraloBusinessErrorInfo,
} from "../airalo/errors";
import { logOrderError, logOrderWarn } from "../observability/logging";
import {
  recordOrderMetrics,
  recordRateLimit,
  type RecordOrderMetricsOptions,
} from "../observability/metrics";

export class OrderServiceError extends Error {
  readonly status: number;
  readonly cause?: unknown;

  constructor(message: string, status = 500, cause?: unknown) {
    super(message);
    this.name = "OrderServiceError";
    this.status = status;
    this.cause = cause;
  }
}

export class OrderValidationError extends OrderServiceError {
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[] = []) {
    super(message, 422);
    this.name = "OrderValidationError";
    this.issues = issues;
  }
}

export class OrderOutOfStockError extends OrderServiceError {
  constructor(message = "This plan is currently out of stock.") {
    super(message, 409);
    this.name = "OrderOutOfStockError";
  }
}

export type AiraloValidationErrors = Record<string, string[]>;
export type MetricsReason = NonNullable<RecordOrderMetricsOptions["reason"]>;
export type AiraloFailurePackage = {
  id: string;
  airaloPackageId: string;
};

type AutoDeactivatePackageInput = {
  reason: string | null;
  businessCode: number | null;
  classification: MetricsReason | null;
};

const AIRALO_FIELD_PATHS: Record<string, string> = {
  iccid: "iccid",
  package_id: "packageId",
  brand_settings_name: "brandSettingsName",
};

const INSUFFICIENT_CREDIT_ERROR_CODES = new Set<number>([11]);
const MAINTENANCE_ERROR_CODES = new Set<number>([13]);
const CHECKSUM_ERROR_CODES = new Set<number>([14]);
const TOPUP_DISABLED_ERROR_CODES = new Set<number>([23]);
const OUT_OF_STOCK_ERROR_CODES = new Set<number>([33]);
const INVALID_PACKAGE_ERROR_CODES = new Set<number>([34]);
const BAD_REQUEST_ERROR_CODES = new Set<number>([43]);
const UNEXPECTED_ERROR_CODES = new Set<number>([53]);
const RECYCLED_SIM_ERROR_CODES = new Set<number>([73]);

const OUT_OF_STOCK_PATTERNS = [/out of stock/i, /insufficient stock/i];
const MAINTENANCE_PATTERNS = [/maintenance/i];
const CHECKSUM_PATTERNS = [/checksum/i];
const RECYCLED_PATTERNS = [/recycled/i];

export function extractAiraloValidationErrors(
  body: unknown,
): AiraloValidationErrors | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = (body as { data?: unknown }).data;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const entries = Object.entries(data as Record<string, unknown>);
  const validationErrors: AiraloValidationErrors = {};

  for (const [field, value] of entries) {
    if (typeof value === "string" && value.trim()) {
      validationErrors[field] = [value];
      continue;
    }

    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      );
      if (messages.length > 0) {
        validationErrors[field] = messages;
      }
    }
  }

  return Object.keys(validationErrors).length > 0 ? validationErrors : null;
}

function firstAiraloFieldMessage(
  fieldErrors: AiraloValidationErrors | null,
  field: string,
): string | null {
  const message = fieldErrors?.[field]?.find(
    (candidate) => candidate.trim().length > 0,
  );
  return message ?? null;
}

function firstAiraloValidationMessage(
  fieldErrors: AiraloValidationErrors | null,
): string | null {
  if (!fieldErrors) {
    return null;
  }

  for (const field of ["package_id", "iccid", "quantity", "brand_settings_name"]) {
    const message = firstAiraloFieldMessage(fieldErrors, field);
    if (message) {
      return message;
    }
  }

  for (const messages of Object.values(fieldErrors)) {
    const message = messages.find((candidate) => candidate.trim().length > 0);
    if (message) {
      return message;
    }
  }

  return null;
}

function buildAiraloValidationIssues(
  fieldErrors: AiraloValidationErrors | null,
): z.ZodIssue[] {
  if (!fieldErrors) {
    return [];
  }

  return Object.entries(fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => ({
      code: z.ZodIssueCode.custom,
      path: [AIRALO_FIELD_PATHS[field] ?? field],
      message,
    })),
  );
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
    (candidate) =>
      typeof candidate === "string" && matchAnyPattern(candidate, patterns),
  );
}

export function classifyAiraloBusinessReason(
  info: AiraloBusinessErrorInfo | null,
  fallback: string | null,
  status: number,
): MetricsReason | null {
  if (status === 409) {
    return "airalo_out_of_stock";
  }

  if (status === 429) {
    return "rate_limited";
  }

  if (status >= 500) {
    return "airalo_unexpected";
  }

  const code = info?.code ?? null;

  if (code !== null) {
    if (OUT_OF_STOCK_ERROR_CODES.has(code)) {
      return "airalo_out_of_stock";
    }

    if (INSUFFICIENT_CREDIT_ERROR_CODES.has(code)) {
      return "insufficient_credit";
    }

    if (MAINTENANCE_ERROR_CODES.has(code)) {
      return "operator_maintenance";
    }

    if (CHECKSUM_ERROR_CODES.has(code)) {
      return "checksum_failed";
    }

    if (TOPUP_DISABLED_ERROR_CODES.has(code)) {
      return "topup_disabled";
    }

    if (BAD_REQUEST_ERROR_CODES.has(code)) {
      return "airalo_bad_request";
    }

    if (UNEXPECTED_ERROR_CODES.has(code)) {
      return "airalo_unexpected";
    }

    if (RECYCLED_SIM_ERROR_CODES.has(code)) {
      return "iccid_recycled";
    }
  }

  if (hasPatternMatch(info, fallback, OUT_OF_STOCK_PATTERNS)) {
    return "airalo_out_of_stock";
  }

  if (hasPatternMatch(info, fallback, MAINTENANCE_PATTERNS)) {
    return "operator_maintenance";
  }

  if (hasPatternMatch(info, fallback, RECYCLED_PATTERNS)) {
    return "iccid_recycled";
  }

  if (hasPatternMatch(info, fallback, CHECKSUM_PATTERNS)) {
    return "checksum_failed";
  }

  return null;
}

export function shouldAutoDeactivatePackage(
  businessCode: number | null,
  classification: MetricsReason | null,
): boolean {
  if (businessCode !== null && INVALID_PACKAGE_ERROR_CODES.has(businessCode)) {
    return true;
  }

  if (businessCode !== null && OUT_OF_STOCK_ERROR_CODES.has(businessCode)) {
    return true;
  }

  return classification === "airalo_out_of_stock";
}

export function mapAiraloError(
  error: AiraloError,
  businessErrorOverride?: AiraloBusinessErrorInfo | null,
): OrderServiceError {
  const status = error.details.status;
  const businessError =
    businessErrorOverride ?? extractAiraloBusinessError(error.details.body);
  const detailedMessage =
    businessError?.reason ?? businessError?.message ?? error.message;
  const candidateMessage = businessError?.message ?? error.message;
  const fieldErrors = extractAiraloValidationErrors(error.details.body);
  const fieldValidationMessage = firstAiraloValidationMessage(fieldErrors);
  const classified = classifyAiraloError({
    status,
    body: error.details.body,
    fallbackMessage: error.message,
  });

  const businessCode = businessError?.code ?? null;

  const hasOutOfStockSignal =
    status === 409 ||
    (businessCode !== null && OUT_OF_STOCK_ERROR_CODES.has(businessCode)) ||
    classified.category === "out_of_stock" ||
    hasPatternMatch(businessError, candidateMessage, OUT_OF_STOCK_PATTERNS);

  if (hasOutOfStockSignal) {
    return new OrderOutOfStockError(
      businessError?.reason ?? businessError?.message ?? undefined,
    );
  }

  if (
    businessCode !== null &&
    INSUFFICIENT_CREDIT_ERROR_CODES.has(businessCode)
  ) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo rejected the order because the partner credit balance is insufficient. Top up the Airalo wallet and retry.",
      402,
      error,
    );
  }

  if (businessCode !== null && INVALID_PACKAGE_ERROR_CODES.has(businessCode)) {
    return new OrderValidationError(
      businessError?.reason ??
        "Selected plan is no longer valid. Refresh the catalog and try a different plan.",
    );
  }

  if (businessCode !== null && TOPUP_DISABLED_ERROR_CODES.has(businessCode)) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo reported that the requested top-up is currently disabled by the operator.",
      409,
      error,
    );
  }

  if (
    (businessCode !== null && RECYCLED_SIM_ERROR_CODES.has(businessCode)) ||
    classified.category === "iccid_recycled" ||
    hasPatternMatch(businessError, candidateMessage, RECYCLED_PATTERNS)
  ) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo indicates the requested SIM has already been recycled and cannot be provisioned or topped up.",
      410,
      error,
    );
  }

  if (
    (businessCode !== null && MAINTENANCE_ERROR_CODES.has(businessCode)) ||
    classified.category === "operator_maintenance" ||
    hasPatternMatch(businessError, candidateMessage, MAINTENANCE_PATTERNS)
  ) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo reports the operator is undergoing maintenance. Pause sales for this plan and retry later.",
      503,
      error,
    );
  }

  if (
    (businessCode !== null && CHECKSUM_ERROR_CODES.has(businessCode)) ||
    classified.category === "checksum_failed" ||
    hasPatternMatch(businessError, candidateMessage, CHECKSUM_PATTERNS)
  ) {
    return new OrderValidationError(
      businessError?.reason ??
        "Airalo rejected the request because of a checksum mismatch in the supplied ICCID or payload.",
    );
  }

  if (businessCode !== null && BAD_REQUEST_ERROR_CODES.has(businessCode)) {
    return new OrderValidationError(
      businessError?.reason ??
        "Airalo rejected the request as invalid. Verify the payload fields and try again.",
    );
  }

  if (
    (businessCode !== null && UNEXPECTED_ERROR_CODES.has(businessCode)) ||
    classified.category === "unexpected"
  ) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo reported an unexpected temporary issue. Please retry shortly.",
      503,
      error,
    );
  }

  if (status === 422) {
    return new OrderValidationError(
      fieldValidationMessage ??
        detailedMessage ??
        "Airalo rejected the order request.",
      buildAiraloValidationIssues(fieldErrors),
    );
  }

  return new OrderServiceError(detailedMessage, status, error);
}

function extractAiraloRequestId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const candidate =
    (body as { request_id?: unknown }).request_id ??
    (body as { requestId?: unknown }).requestId;

  if (typeof candidate === "string" && candidate.trim()) {
    return candidate;
  }

  return null;
}

export async function handleAiraloOrderFailure(options: {
  error: unknown;
  pkg: AiraloFailurePackage;
  startedAt: number;
  airaloLatencyMs: number;
  beforeMapping?: () => Promise<void>;
  autoDeactivatePackage?: (input: AutoDeactivatePackageInput) => Promise<void>;
}): Promise<never> {
  await options.beforeMapping?.();

  if (options.error instanceof AiraloError) {
    const requestId = extractAiraloRequestId(options.error.details.body);
    const businessError = extractAiraloBusinessError(options.error.details.body);
    const businessMessage =
      businessError?.reason ?? businessError?.message ?? null;
    if (options.error.details.status === 429) {
      recordRateLimit("orders");
    }

    const isAiraloValidationError = options.error.details.status === 422;

    logOrderError("airalo.order.create.failed", {
      packageId: options.pkg.id,
      packageExternalId: options.pkg.airaloPackageId,
      airaloStatus: options.error.details.status,
      airaloRequestId: requestId,
      airaloErrorCode: businessError?.code ?? null,
      airaloErrorReason: businessError?.reason ?? null,
      latencyMs: options.airaloLatencyMs,
      message: options.error.message,
    });

    if (isAiraloValidationError) {
      const fieldErrors = extractAiraloValidationErrors(
        options.error.details.body,
      );
      const validationFields = fieldErrors ? Object.keys(fieldErrors) : null;
      logOrderError("order.validation.failed", {
        packageId: options.pkg.id,
        packageExternalId: options.pkg.airaloPackageId,
        airaloStatus: options.error.details.status,
        airaloRequestId: requestId,
        airaloErrorCode: businessError?.code ?? null,
        airaloErrorReason: businessError?.reason ?? null,
        latencyMs: options.airaloLatencyMs,
        fieldErrors,
        validationFields,
      });
    }

    const classification = classifyAiraloBusinessReason(
      businessError,
      businessMessage ?? options.error.message,
      options.error.details.status,
    );

    if (
      shouldAutoDeactivatePackage(businessError?.code ?? null, classification)
    ) {
      options
        .autoDeactivatePackage?.({
          reason: businessMessage ?? options.error.message,
          businessCode: businessError?.code ?? null,
          classification,
        })
        .catch((deactivationError) => {
          logOrderWarn("catalog.package.auto_pause_failed", {
            packageId: options.pkg.id,
            packageExternalId: options.pkg.airaloPackageId,
            error:
              deactivationError instanceof Error
                ? deactivationError.message
                : String(deactivationError),
          });
        });
    }

    const mapped = mapAiraloError(options.error, businessError);

    const metricsReason = isAiraloValidationError
      ? "validation_failed"
      : (classification ??
        (options.error.details.status === 429 ? "rate_limited" : "airalo_error"));

    recordOrderMetrics({
      result: "error",
      reason: metricsReason,
      durationMs: Date.now() - options.startedAt,
      airaloStatus: options.error.details.status,
    });

    throw mapped;
  }

  const mapped = new OrderServiceError(
    "Failed to create order with Airalo.",
    500,
    options.error,
  );

  logOrderError("airalo.order.create.failed", {
    packageId: options.pkg.id,
    packageExternalId: options.pkg.airaloPackageId,
    latencyMs: options.airaloLatencyMs,
    message: mapped.message,
    error: options.error instanceof Error ? options.error.message : String(options.error),
  });

  recordOrderMetrics({
    result: "error",
    reason: "unexpected",
    durationMs: Date.now() - options.startedAt,
    airaloStatus: "unknown",
  });

  throw mapped;
}
