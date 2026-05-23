import { NextResponse } from "next/server";
import { z } from "zod";

type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

function toZodIssueDetails(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map((segment) => String(segment)).join("."),
    })),
  };
}

export function jsonApiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const payload: ApiErrorPayload = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return NextResponse.json(payload, { status });
}

export function jsonBadRequest(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return jsonApiError(400, code, message, details);
}

export function jsonUnauthorized(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return jsonApiError(401, code, message, details);
}

export function jsonForbidden(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return jsonApiError(403, code, message, details);
}

export function jsonNotFound(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return jsonApiError(404, code, message, details);
}

export function jsonServerError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return jsonApiError(500, code, message, details);
}

export function jsonInvalidJson(message = "Invalid JSON payload.") {
  return jsonApiError(400, "invalid_json", message);
}

export function jsonValidationError(
  error: z.ZodError,
  message = "Request validation failed.",
) {
  return jsonApiError(422, "validation_error", message, toZodIssueDetails(error));
}
