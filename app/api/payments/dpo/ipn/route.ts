import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import prismaClient from "@/lib/db/client";
import { jsonInvalidJson, jsonValidationError } from "@/lib/api/errors";
import {
  finaliseOrderFromCheckout,
  recordPaymentEvent,
  setCheckoutStatus,
  updatePaymentStatus,
} from "@/lib/payments/checkouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DpoIpnPayloadSchema = z.record(z.unknown());
const DpoTokenSchema = z.string().trim().min(1, "Transaction token missing");

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

function parsePayload(body: string, contentType: string | null): unknown {
  if (contentType?.includes("application/json")) {
    return JSON.parse(body);
  }

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
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

  let parsedPayload: unknown;

  try {
    parsedPayload = parsePayload(rawBody, contentType);
  } catch {
    return jsonInvalidJson("Invalid payload.");
  }

  const payloadResult = DpoIpnPayloadSchema.safeParse(parsedPayload);
  if (!payloadResult.success) {
    return jsonValidationError(payloadResult.error);
  }
  const payload = payloadResult.data;

  const tokenCandidate =
    payload.TransactionToken ?? payload.transactionToken ?? payload.TransactionRef ?? payload.transactionRef;
  const tokenResult = DpoTokenSchema.safeParse(tokenCandidate);
  if (!tokenResult.success) {
    return jsonValidationError(tokenResult.error);
  }
  const token = tokenResult.data;

  const status = normaliseStatus(payload.Result ?? payload.result ?? payload.Status ?? payload.status);

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
