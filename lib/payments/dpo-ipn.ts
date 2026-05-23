import crypto from "node:crypto";
import { z } from "zod";

const DpoIpnPayloadSchema = z.record(z.unknown());
const DpoTokenSchema = z.string().trim().min(1, "Transaction token missing");

type DpoIpnTransaction = {
  id: string;
  checkoutId: string | null;
};

type DpoIpnDeps = {
  findPaymentTransaction: (token: string) => Promise<DpoIpnTransaction | null>;
  recordPaymentEvent: (
    transactionId: string,
    eventType: string,
    payload: unknown,
  ) => Promise<void>;
  updatePaymentStatus: (
    transactionId: string,
    status: string,
    options: { metadata?: Record<string, unknown> },
  ) => Promise<void>;
  finaliseOrderFromCheckout: (
    checkoutId: string,
    options: { forceStatus: string },
  ) => Promise<unknown>;
  setCheckoutStatus: (checkoutId: string, status: string) => Promise<void>;
};

export type DpoIpnResult = {
  status: number;
  body: Record<string, unknown>;
};

function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): DpoIpnResult {
  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
  };
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function verifyDpoIpnSignature(options: {
  body: string;
  signature: string | null;
  secret?: string | null;
  allowMissingSecret: boolean;
}): boolean {
  const secret = options.secret?.trim();

  if (!secret) {
    return options.allowMissingSecret;
  }

  const signature = options.signature?.trim().replace(/^sha256=/i, "");
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(options.body)
    .digest("hex");

  return timingSafeEqualString(expected, signature);
}

export function parseDpoIpnPayload(
  body: string,
  contentType: string | null,
): unknown {
  if (contentType?.includes("application/json")) {
    return JSON.parse(body);
  }

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

export function normaliseDpoStatus(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  return value.trim().toLowerCase();
}

function zodIssueDetails(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map((segment) => String(segment)).join("."),
    })),
  };
}

export async function handleDpoIpn(options: {
  rawBody: string;
  signature: string | null;
  contentType: string | null;
  secret?: string | null;
  nodeEnv?: string;
  deps: DpoIpnDeps;
}): Promise<DpoIpnResult> {
  const hasValidSignature = verifyDpoIpnSignature({
    body: options.rawBody,
    signature: options.signature,
    secret: options.secret,
    allowMissingSecret: options.nodeEnv !== "production",
  });

  if (!hasValidSignature) {
    return apiError(401, "invalid_signature", "Invalid signature");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = parseDpoIpnPayload(options.rawBody, options.contentType);
  } catch {
    return apiError(400, "invalid_json", "Invalid payload.");
  }

  const payloadResult = DpoIpnPayloadSchema.safeParse(parsedPayload);
  if (!payloadResult.success) {
    return apiError(
      422,
      "validation_error",
      "Request validation failed.",
      zodIssueDetails(payloadResult.error),
    );
  }
  const payload = payloadResult.data;

  const tokenCandidate =
    payload.TransactionToken ??
    payload.transactionToken ??
    payload.TransactionRef ??
    payload.transactionRef;
  const tokenResult = DpoTokenSchema.safeParse(tokenCandidate);
  if (!tokenResult.success) {
    return apiError(
      422,
      "validation_error",
      "Request validation failed.",
      zodIssueDetails(tokenResult.error),
    );
  }
  const token = tokenResult.data;

  const status = normaliseDpoStatus(
    payload.Result ?? payload.result ?? payload.Status ?? payload.status,
  );

  const transaction = await options.deps.findPaymentTransaction(token);

  if (!transaction) {
    return apiError(
      404,
      "payment_transaction_not_found",
      "Transaction not found",
    );
  }

  await options.deps.recordPaymentEvent(transaction.id, "ipn", payload);
  await options.deps.updatePaymentStatus(transaction.id, status, {
    metadata: payload,
  });

  if (transaction.checkoutId) {
    if (status === "approved") {
      try {
        await options.deps.finaliseOrderFromCheckout(transaction.checkoutId, {
          forceStatus: status,
        });
      } catch {
        return {
          status: 200,
          body: { ok: true, warning: "checkout_finalization_failed" },
        };
      }
    } else if (
      status === "failed" ||
      status === "declined" ||
      status === "cancelled"
    ) {
      await options.deps.setCheckoutStatus(transaction.checkoutId, "failed");
    }
  }

  return {
    status: 200,
    body: { ok: true },
  };
}

