import { resolveAppBaseUrl } from "./app-base-url";

/** Use the configured public URL: proxies and Next.js can normalize the request hostname. */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  try {
    return origin === resolveAppBaseUrl({ requestUrl: request.url, configuredUrl: process.env.NEXT_PUBLIC_APP_URL, authUrl: process.env.NEXTAUTH_URL });
  } catch { return false; }
}
