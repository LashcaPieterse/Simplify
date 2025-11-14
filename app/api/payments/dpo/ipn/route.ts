import crypto from "node:crypto";

import { NextResponse } from "next/server";

import prismaClient from "@/lib/db/client";
import {
  finaliseOrderFromCheckout,
  recordPaymentEvent,
  setCheckoutStatus,
  updatePaymentStatus,
} from "@/lib/payments/checkouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.DPO_IPN_SECRET;

  if (!secret) {
    return true; // No signature configured, accept payload for non-production use
  }

  if (!signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(expected, signature);
}

function parsePayload(body: string, contentType: string | null): Record<string, unknown> {
  if (contentType?.includes("application/json")) {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function normaliseStatus(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-dpo-signature");
  const contentType = request.headers.get("content-type");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = parsePayload(rawBody, contentType);
  } catch {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const token = (payload.TransactionToken ?? payload.transactionToken ?? payload.TransactionRef ?? payload.transactionRef) as
    | string
    | undefined;
  const status = normaliseStatus(payload.Result ?? payload.result ?? payload.Status ?? payload.status);

  if (!token) {
    return NextResponse.json({ message: "Transaction token missing" }, { status: 400 });
  }

  const transaction = await prismaClient.paymentTransaction.findFirst({
    where: {
      OR: [{ transactionToken: token }, { providerReference: token }],
    },
  });

  if (!transaction) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }

  await recordPaymentEvent(transaction.id, "ipn", payload);
  await updatePaymentStatus(transaction.id, status, { metadata: payload });

  if (transaction.checkoutId) {
    if (status === "approved") {
      await finaliseOrderFromCheckout(transaction.checkoutId, {
        prisma: prismaClient,
        forceStatus: status,
      }).catch((error) => {
        console.error("Failed to finalise order from checkout", error);
      });
    } else if (status === "failed" || status === "declined" || status === "cancelled") {
      await setCheckoutStatus(transaction.checkoutId, "failed", { prisma: prismaClient });
    }
  }

  return NextResponse.json({ ok: true });
}
