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

export function jsonInvalidJson(message = "Invalid JSON payload.") {
  return jsonApiError(400, "invalid_json", message);
}

export function jsonValidationError(
  error: z.ZodError,
  message = "Request validation failed.",
) {
  return jsonApiError(422, "validation_error", message, toZodIssueDetails(error));
}
