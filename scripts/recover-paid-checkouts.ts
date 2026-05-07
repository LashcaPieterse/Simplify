import fs from "node:fs";
import path from "node:path";

import prisma from "../lib/db/client";
import { finaliseOrderFromCheckout } from "../lib/payments/checkouts";

const APPROVED_PAYMENT_STATUSES = new Set(["approved", "paid"]);
const DEFAULT_LIMIT = 100;

type ScriptArgs = {
  dryRun: boolean;
  limit: number;
};

function parseArgs(argv: string[]): ScriptArgs {
  let dryRun = false;
  let limit = DEFAULT_LIMIT;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const raw = arg.split("=")[1];
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.floor(parsed);
      }
    }
  }

  return { dryRun, limit };
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function loadLocalEnvIfNeeded() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const delimiterIndex = line.indexOf("=");
    if (delimiterIndex <= 0) {
      continue;
    }

    const key = line.slice(0, delimiterIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(delimiterIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function main() {
  loadLocalEnvIfNeeded();

  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const candidates = await prisma.checkoutSession.findMany({
    where: {
      orderId: null,
      status: { in: ["paid", "pending"] },
      payments: {
        some: {
          status: { in: ["approved", "paid"] },
        },
      },
    },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      package: {
        select: {
          airaloPackageId: true,
          title: true,
          operator: {
            select: {
              title: true,
              country: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: args.limit,
  });

  let scanned = 0;
  let attempted = 0;
  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  console.info(
    `[checkout-recovery] candidates=${candidates.length} dryRun=${args.dryRun} limit=${args.limit}`,
  );

  for (const checkout of candidates) {
    scanned += 1;
    const payment = checkout.payments[0] ?? null;
    const paymentStatus = normalizeStatus(payment?.status);
    const isApproved = APPROVED_PAYMENT_STATUSES.has(paymentStatus);

    if (!payment || !isApproved) {
      skipped += 1;
      continue;
    }

    const context = {
      checkoutId: checkout.id,
      createdAt: checkout.createdAt.toISOString(),
      checkoutStatus: checkout.status,
      paymentStatus: payment.status,
      packageExternalId: checkout.package.airaloPackageId,
      packageTitle: checkout.package.title,
      country: checkout.package.operator.country.slug,
      operator: checkout.package.operator.title,
    };

    if (args.dryRun) {
      console.info("[checkout-recovery] dry-run candidate", context);
      continue;
    }

    attempted += 1;

    try {
      const result = await finaliseOrderFromCheckout(checkout.id, {
        prisma,
        forceStatus: "approved",
        airaloOptions: {
          submissionMode: "async",
        },
      });

      recovered += 1;
      console.info("[checkout-recovery] recovered", {
        ...context,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        requestId: result.requestId,
      });
    } catch (error) {
      failed += 1;
      console.error("[checkout-recovery] failed", {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.info("[checkout-recovery] summary", {
    scanned,
    attempted,
    recovered,
    skipped,
    failed,
    elapsedMs,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[checkout-recovery] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
