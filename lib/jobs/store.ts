import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export type JobKind = "verify_payment" | "fulfill_checkout" | "reconcile_supplier" | "complete_installation" | "ack_payment";
type Db = PrismaClient | Prisma.TransactionClient;
export const RETRY_DELAYS_MS = [300_000, 900_000, 3_600_000, 14_400_000];
export const retryAt = (attempts: number, now = new Date()) => new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), 3)]);

export function enqueueJob(db: Db, kind: JobKind, targetId: string) {
  return db.lifecycleJob.upsert({ where: { businessKey: `${kind}:${targetId}` }, update: {},
    create: { businessKey: `${kind}:${targetId}`, kind, targetId } });
}

export async function claimJob(db: PrismaClient, id: string, now = new Date()) {
  const leaseToken = randomUUID();
  const claimed = await db.lifecycleJob.updateMany({ where: { id, nextAttemptAt: { lte: now },
    OR: [{ status: "pending" }, { status: "leased", leaseUntil: { lte: now } }] },
    data: { status: "leased", leaseToken, leaseUntil: new Date(now.getTime() + 120_000), attempts: { increment: 1 } } });
  return claimed.count === 1 ? db.lifecycleJob.findFirst({ where: { id, leaseToken } }) : null;
}

export async function finishJob(db: PrismaClient, job: { id: string; leaseToken: string | null; attempts: number }, result: "done" | "retry" | "review", code?: string) {
  await db.lifecycleJob.updateMany({ where: { id: job.id, status: "leased", leaseToken: job.leaseToken }, data: {
    status: result === "retry" ? "pending" : result,
    nextAttemptAt: retryAt(job.attempts), leaseToken: null, leaseUntil: null, lastError: code?.slice(0, 100) ?? null,
  } });
}
