import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { Prisma } from "@prisma/client";

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

function resolveCheckoutError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("Checkout failed with Prisma known request error", {
      code: error.code,
      message: error.message,
    });

    return {
      message:
        "Checkout is temporarily unavailable. Please try again in a moment.",
      status: 503,
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("Checkout failed with Prisma initialization error", {
      message: error.message,
    });

    return {
      message:
        "Checkout is temporarily unavailable. Please try again in a moment.",
      status: 503,
    };
  }

  const rawMessage = error instanceof Error ? error.message : "";
  const normalizedMessage = rawMessage.toLowerCase();
  const isDbPoolSaturation =
    normalizedMessage.includes("max clients reached") ||
    normalizedMessage.includes("pool_size") ||
    normalizedMessage.includes("too many clients") ||
    normalizedMessage.includes("remaining connection slots are reserved");

  if (isDbPoolSaturation) {
    console.error("Checkout failed due to database pool saturation", {
      rawMessage,
    });
    return {
      message:
        "Checkout is temporarily unavailable due to high demand. Please try again shortly.",
      status: 503,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, status: 422 };
  }

  return { message: "Failed to create checkout.", status: 422 };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const session = await getServerSession(authOptions);
    const payload =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? { ...rawBody }
        : {};

    if (typeof payload.customerEmail === "string") {
      payload.customerEmail = payload.customerEmail.trim();
    }

    if (session?.user?.email && !payload.customerEmail) {
      payload.customerEmail = session.user.email;
    }

    const baseUrl = resolveBaseUrl(request);
    const result = await createCheckout(payload, {
      baseUrl,
      userId: session?.user?.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const resolved = resolveCheckoutError(error);
    return NextResponse.json(
      { message: resolved.message },
      { status: resolved.status },
    );
  }
}
