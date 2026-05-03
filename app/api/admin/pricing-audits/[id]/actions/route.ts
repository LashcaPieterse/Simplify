import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { jsonInvalidJson, jsonValidationError } from "@/lib/api/errors";
import { requireAdminApiSession } from "@/lib/admin/guards";

const PricingAuditActionBodySchema = z.object({
  action: z.enum(["push-db-to-published", "pull-published-to-db", "resync-package"]),
});
const PricingAuditActionParamsSchema = z.object({
  id: z.string().trim().min(1, "Audit id is required."),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = PricingAuditActionParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return jsonValidationError(parsedParams.error);
  }

  const parseFailed = Symbol("parse_failed");
  const rawBody = await request.json().catch(() => parseFailed);
  if (rawBody === parseFailed) {
    return jsonInvalidJson();
  }

  const parsedBody = PricingAuditActionBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonValidationError(parsedBody.error);
  }

  const payload = parsedBody.data;
  const audit = await prisma.pricingAudit.findUnique({ where: { id: parsedParams.data.id } });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payload.action === "push-db-to-published") {
    if (audit.dbPrice === null) return NextResponse.json({ error: "No DB price available" }, { status: 400 });
    await prisma.publishingState.upsert({
      where: { packageAiraloId: audit.packageAiraloId },
      create: {
        packageAiraloId: audit.packageAiraloId,
        publishedPrice: audit.dbPrice,
        publishedCurrency: audit.currency,
        publishedAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {
        publishedPrice: audit.dbPrice,
        publishedCurrency: audit.currency,
        publishedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  if (payload.action === "pull-published-to-db") {
    if (audit.publishedPrice === null) return NextResponse.json({ error: "No published price available" }, { status: 400 });
    await prisma.packageState.updateMany({
      where: { package: { airaloPackageId: audit.packageAiraloId } },
      data: {
        sellPriceDecimal: audit.publishedPrice,
        sellingPriceCents: Math.round(Number(audit.publishedPrice) * 100),
      },
    });
  }

  if (payload.action === "resync-package") {
    await prisma.pricingAudit.update({
      where: { id: audit.id },
      data: { resolutionNotes: "Package re-sync queued by admin" },
    });
  }

  await prisma.pricingAudit.update({
    where: { id: audit.id },
    data: {
      status: "resolved",
      resolvedBy: session.email,
      resolvedAt: new Date(),
      resolutionNotes: `Action executed: ${payload.action}`,
    },
  });

  return NextResponse.json({ ok: true });
}
