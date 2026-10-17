type ResolveAppBaseUrlOptions = {
  requestUrl: string;
  configuredUrl?: string | null;
  authUrl?: string | null;
  nodeEnv?: string | null;
};

function toHttpOrigin(value: string, label: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }

  if (url.username || url.password) {
    throw new Error(`${label} must not include credentials.`);
  }

  return url.origin;
}

/**
 * Resolves the trusted application origin used for payment redirects and
 * provider callbacks. Production deliberately fails closed when no canonical
 * URL is configured instead of trusting client-controlled Origin/Host values.
 */
export function resolveAppBaseUrl({
  requestUrl,
  configuredUrl,
  authUrl,
  nodeEnv = process.env.NODE_ENV,
}: ResolveAppBaseUrlOptions): string {
  const configured = configuredUrl?.trim() || authUrl?.trim();
  if (configured) return toHttpOrigin(configured, "Application URL");

  if (nodeEnv === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or NEXTAUTH_URL must be configured before checkout can start.",
    );
  }

  return toHttpOrigin(requestUrl, "Request URL");
}
