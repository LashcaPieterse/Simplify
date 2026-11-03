import { randomUUID } from "node:crypto";
import type { LifecycleJob, Prisma, PrismaClient } from "@prisma/client";

export type JobKind = "verify_payment" | "fulfill_checkout" | "reconcile_supplier" | "complete_installation" | "ack_payment";
type Db = PrismaClient | Prisma.TransactionClient;
export const RETRY_DELAYS_MS = [300_000, 900_000, 3_600_000, 14_400_000];
export const retryAt = (attempts: number, now = new Date()) => new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), 3)]);
export const VERIFICATION_COOLDOWN_MS = 15_000;

export function jobEligibleAt(job: Pick<LifecycleJob, "kind" | "nextAttemptAt" | "lastAttemptAt">) {
  return Math.max(job.nextAttemptAt.getTime(), job.kind === "verify_payment" && job.lastAttemptAt ? job.lastAttemptAt.getTime() + VERIFICATION_COOLDOWN_MS : 0);
}

export function enqueueJob(db: Db, kind: JobKind, targetId: string) {
  return db.lifecycleJob.upsert({ where: { businessKey: `${kind}:${targetId}` }, update: {},
    create: { businessKey: `${kind}:${targetId}`, kind, targetId } });
}

/** New information shortens a retry, while an active lease keeps its owner. */
export async function wakeJob(db: Db, kind: JobKind, targetId: string, options: { reopenDone?: boolean; reopenReview?: boolean } = {}) {
  const job = await enqueueJob(db, kind, targetId);
  const now = new Date();
  const rows = await db.$queryRaw<LifecycleJob[]>`
    UPDATE "LifecycleJob" SET "wakeVersion"="wakeVersion"+1,
      "lastAttemptAt"=COALESCE("lastAttemptAt", CASE WHEN attempts>0 THEN "updatedAt" END),
      status=CASE WHEN status='leased' THEN status ELSE 'pending' END,
      "nextAttemptAt"=CASE WHEN status='leased' THEN "nextAttemptAt" ELSE LEAST("nextAttemptAt",
        GREATEST(${now.toISOString()}::timestamp, COALESCE("lastAttemptAt", CASE WHEN attempts>0 THEN "updatedAt" END, ${now.toISOString()}::timestamp - interval '15 seconds')
          + CASE WHEN kind='verify_payment' THEN interval '15 seconds' ELSE interval '0 seconds' END)) END,
      "updatedAt"=${now.toISOString()}::timestamp, "lastError"=CASE WHEN status='leased' THEN "lastError" ELSE NULL END
    WHERE id=${job.id} AND (status IN ('pending','leased') OR (status='done' AND ${options.reopenDone ?? false}) OR (status='review' AND ${options.reopenReview ?? false}))
    RETURNING *`;
  return rows[0] ?? job;
}

export async function claimJob(db: PrismaClient, id: string, now = new Date()) {
  const leaseToken = randomUUID();
  // RETURNING captures the wake generation atomically with the lease. A later
  // wakeup must not be mistaken for information consumed by this attempt.
  const rows = await db.$queryRaw<LifecycleJob[]>`
    UPDATE "LifecycleJob" SET status='leased', "leaseToken"=${leaseToken}, "leaseUntil"=${new Date(now.getTime() + 120_000).toISOString()}::timestamp,
      attempts=attempts+1, "lastAttemptAt"=${now.toISOString()}::timestamp, "updatedAt"=${now.toISOString()}::timestamp
    WHERE id=${id} AND "nextAttemptAt"<=${now.toISOString()}::timestamp
      AND (kind<>'verify_payment' OR "lastAttemptAt" IS NULL OR "lastAttemptAt"<=${new Date(now.getTime() - VERIFICATION_COOLDOWN_MS).toISOString()}::timestamp)
      AND (status='pending' OR (status='leased' AND "leaseUntil"<=${now.toISOString()}::timestamp)) RETURNING *`;
  return rows[0] ?? null;
}

export async function finishJob(db: PrismaClient, job: Pick<LifecycleJob, "id" | "leaseToken" | "attempts" | "wakeVersion">, result: "done" | "retry" | "review", code?: string) {
  const now = new Date();
  await db.$executeRaw`
    UPDATE "LifecycleJob" SET
      status=CASE WHEN ${result}='review' THEN 'review' WHEN "wakeVersion">${job.wakeVersion} OR ${result}='retry' THEN 'pending' ELSE 'done' END,
      "nextAttemptAt"=CASE WHEN ${result}<>'review' AND "wakeVersion">${job.wakeVersion}
        THEN GREATEST(${now.toISOString()}::timestamp, COALESCE("lastAttemptAt",${now.toISOString()}::timestamp) + CASE WHEN kind='verify_payment' THEN interval '15 seconds' ELSE interval '0 seconds' END)
        ELSE ${retryAt(job.attempts, now).toISOString()}::timestamp END,
      "leaseToken"=NULL, "leaseUntil"=NULL, "updatedAt"=${now.toISOString()}::timestamp, "lastError"=${code?.slice(0,100) ?? null}
    WHERE id=${job.id} AND status='leased' AND "leaseToken"=${job.leaseToken}`;
}
