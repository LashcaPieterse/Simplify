import { timingSafeEqual } from "node:crypto";

const AIRALO_WEBHOOK_SECRET_QUERY_PARAMS = [
  "airalo_webhook_secret",
  "webhook_secret",
] as const;

export interface AiraloWebhookAuthResult {
  valid: boolean;
  method: "url_secret" | null;
  hasUrlSecret: boolean;
}

function safeEqualString(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function readAiraloWebhookUrlSecret(requestUrl: string): string | null {
  const url = new URL(requestUrl);

  for (const param of AIRALO_WEBHOOK_SECRET_QUERY_PARAMS) {
    const value = url.searchParams.get(param);
    if (value) {
      return value;
    }
  }

  return null;
}

export function authenticateAiraloWebhookRequest({
  requestUrl,
  secret,
}: {
  requestUrl: string;
  secret: string;
}): AiraloWebhookAuthResult {
  const urlSecret = readAiraloWebhookUrlSecret(requestUrl);
  const valid = urlSecret ? safeEqualString(urlSecret, secret) : false;

  return {
    valid,
    method: valid ? "url_secret" : null,
    hasUrlSecret: Boolean(urlSecret),
  };
}
