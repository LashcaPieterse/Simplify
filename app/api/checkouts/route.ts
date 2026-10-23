import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { limitCheckout, abuseResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { NextResponse, NextRequest } from "next/server";
import { REFERRAL_COOKIE } from "@/lib/affiliates/referral";
import { getServerSession } from "next-auth";

import { Prisma } from "@prisma/client";

import { QUOTE_SESSION_COOKIE } from "@/lib/payments/quotes";
import { createCheckout } from "@/lib/payments/checkouts";
import {
  CheckoutRequestError,
  prepareCheckoutRequestPayload,
} from "@/lib/payments/checkout-request";
import { authOptions } from "@/lib/auth/options";
import {
  canIssueScopedAccessTokens,
  setScopedAccessCookie,
} from "@/lib/orders/access";
import { resolveAppBaseUrl } from "@/lib/http/app-base-url";

export const dynamic = "force-dynamic";

function resolveCheckoutError(error: unknown): {
  message: string;
  status: number;
  field?: string;
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
    if (error instanceof CheckoutRequestError) {
      return { message: error.message, status: error.status, field: error.field };
    }

    return { message: error.message, status: 422 };
  }

  return { message: "Failed to create checkout.", status: 422 };
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    await limitCheckout(request.headers, request.cookies.get(QUOTE_SESSION_COOKIE)?.value ?? "no-session");
    const rawBody = await readJsonBody(request);
    const session = await getServerSession(authOptions);
    const canIssueGuestAccess = canIssueScopedAccessTokens();

    if (!(session?.user?.emailProofVerified && !session.user.recoveryRequired ? session.user.id : undefined) && !canIssueGuestAccess) {
      return NextResponse.json(
        {
          message:
            "Checkout is temporarily unavailable. Guest access token signing is not configured.",
        },
        { status: 503 },
      );
    }

    const payload = prepareCheckoutRequestPayload(rawBody, {
      sessionEmail: session?.user?.email,
      isAuthenticated: Boolean((session?.user?.emailProofVerified && !session.user.recoveryRequired ? session.user.id : undefined)),
    }) as Parameters<typeof createCheckout>[0];

    const baseUrl = resolveAppBaseUrl({
      requestUrl: request.url,
      configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
      authUrl: process.env.NEXTAUTH_URL,
    });
    const result = await createCheckout(payload, {
      baseUrl,
      guestSessionId: request.cookies.get(QUOTE_SESSION_COOKIE)?.value,
      userId: (session?.user?.emailProofVerified && !session.user.recoveryRequired ? session.user.id : undefined),
      referralToken: request.cookies.get(REFERRAL_COOKIE)?.value,
    });

    const response = NextResponse.json(result, { status: 201 });
    if (canIssueGuestAccess) {
      setScopedAccessCookie(response.cookies, "checkout", result.checkoutId);
    }

    return response;
  } catch (error) {
    const limited = abuseResponse(error);
    if (limited) return limited;
    if (error instanceof BodyError) return NextResponse.json({ message: error.message }, { status: error.status });
    const resolved = resolveCheckoutError(error);
    return NextResponse.json(
      { message: resolved.message, field: resolved.field },
      { status: resolved.status },
    );
  }
}
