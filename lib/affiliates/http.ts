import { resolveAppBaseUrl } from "../http/app-base-url";

export function affiliateAppOrigin(requestUrl = "http://localhost:3000") {
  return resolveAppBaseUrl({ requestUrl, configuredUrl: process.env.NEXT_PUBLIC_APP_URL, authUrl: process.env.NEXTAUTH_URL });
}

export function isAffiliateSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === affiliateAppOrigin(request.url));
}
