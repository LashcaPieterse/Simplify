import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";

interface PublishingPayload {
  package_airalo_id: string;
  sanity_document_id?: string;
  published_price?: number;
  published_currency?: string;
  published_at?: string;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  const auth = request.headers.get("x-sanity-webhook-secret");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as PublishingPayload;
  if (!payload.package_airalo_id) {
    return NextResponse.json({ error: "package_airalo_id is required" }, { status: 400 });
  }

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
