export class CheckoutRequestError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function prepareCheckoutRequestPayload(
  rawBody: unknown,
  options: { sessionEmail?: string | null; isAuthenticated: boolean },
): Record<string, unknown> {
  const payload = isRecord(rawBody) ? { ...rawBody } : {};

  if (typeof payload.customerEmail === "string") {
    payload.customerEmail = normalizeEmailAddress(payload.customerEmail);
  }

  if (options.sessionEmail && !payload.customerEmail) {
    payload.customerEmail = normalizeEmailAddress(options.sessionEmail);
  }

  const intent = payload.intent === "top-up" ? "top-up" : "purchase";
  const isGuestPurchase = !options.isAuthenticated && intent === "purchase";

  if (isGuestPurchase && !payload.customerEmail) {
    throw new CheckoutRequestError(
      "Enter an email address so we can send your eSIM and receipt.",
    );
  }

  return payload;
}
