import { NextRequest, NextResponse } from "next/server";
import { requestHasValidSession } from "./lib/auth";

const ADMIN_WEBHOOK_PATHS = new Set(["/api/admin/publishing-state"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  if (normalizedPathname.startsWith("/admin") && !normalizedPathname.startsWith("/admin/login")) {
    const hasSession = await requestHasValidSession(request);
    if (!hasSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", normalizedPathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (normalizedPathname.startsWith("/api/admin")) {
    // These routes use shared-secret webhook auth in-route instead of admin sessions.
    if (ADMIN_WEBHOOK_PATHS.has(normalizedPathname)) {
      return NextResponse.next();
    }

    const hasSession = await requestHasValidSession(request);
    if (!hasSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
