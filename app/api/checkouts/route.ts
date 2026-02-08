import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { createCheckout } from "@/lib/payments/checkouts";
import { authOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

function resolveBaseUrl(request: Request): string {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return originHeader;
  }

  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const session = await getServerSession(authOptions);
    const payload =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? { ...rawBody } : {};

    if (typeof payload.customerEmail === "string") {
      payload.customerEmail = payload.customerEmail.trim();
    }

    if (session?.user?.email && !payload.customerEmail) {
      payload.customerEmail = session.user.email;
    }

    const baseUrl = resolveBaseUrl(request);
    const result = await createCheckout(payload, { baseUrl, userId: session?.user?.id });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout.";
    return NextResponse.json({ message }, { status: 422 });
  }
}
