import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { jsonInvalidJson, jsonValidationError } from "@/lib/api/errors";

const PublishingPayloadSchema = z
  .object({
    package_airalo_id: z.string().trim().min(1, "package_airalo_id is required"),
    sanity_document_id: z.string().trim().min(1).optional(),
    published_price: z.number().finite().optional(),
    published_currency: z.string().trim().min(1).optional(),
    published_at: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "published_at must be a valid datetime string.",
      })
      .optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  const auth = request.headers.get("x-sanity-webhook-secret");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseFailed = Symbol("parse_failed");
  const rawBody = await request.json().catch(() => parseFailed);
  if (rawBody === parseFailed) {
    return jsonInvalidJson();
  }

  const parsedBody = PublishingPayloadSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonValidationError(parsedBody.error);
  }

  const payload = parsedBody.data;
  const state = await prisma.publishingState.upsert({
    where: { packageAiraloId: payload.package_airalo_id },
    create: {
      packageAiraloId: payload.package_airalo_id,
      sanityDocumentId: payload.sanity_document_id ?? null,
      publishedPrice: payload.published_price ?? null,
      publishedCurrency: payload.published_currency ?? null,
      publishedAt: payload.published_at ? new Date(payload.published_at) : new Date(),
      lastSeenAt: new Date(),
    },
    update: {
      sanityDocumentId: payload.sanity_document_id ?? undefined,
      publishedPrice: payload.published_price ?? undefined,
      publishedCurrency: payload.published_currency ?? undefined,
      publishedAt: payload.published_at ? new Date(payload.published_at) : undefined,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, state });
}
