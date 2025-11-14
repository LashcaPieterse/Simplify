import { NextResponse } from "next/server";

import { createCheckout } from "@/lib/payments/checkouts";

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
    const body = await request.json();
    const baseUrl = resolveBaseUrl(request);
    const result = await createCheckout(body, { baseUrl });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout.";
    return NextResponse.json({ message }, { status: 422 });
  }
}
