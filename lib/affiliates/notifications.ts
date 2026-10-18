import type { PrismaClient, Prisma } from "@prisma/client";
import prisma from "../db/client";
import { sendEmail } from "../notifications/email";
import { affiliateInfrastructureEnabled } from "./referral";

export function queueAffiliateNotification(tx: Prisma.TransactionClient, affiliateId: string, key: string, recipient: string, subject: string, text: string) {
  return tx.affiliateNotification.upsert({ where: { idempotencyKey: key }, update: {}, create: { affiliateId, idempotencyKey: key, recipient, subject, text } });
}

export async function deliverAffiliateNotifications(db: PrismaClient = prisma, limit = 5, send = sendEmail) {
  if (!affiliateInfrastructureEnabled()) return { sent: 0, pending: 0 };
  const now = new Date();
  const notifications = await db.affiliateNotification.findMany({ where: { sentAt: null, nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  let sent = 0;
  for (const notification of notifications) {
    const lease = await db.affiliateNotification.updateMany({ where: { id: notification.id, sentAt: null, nextAttemptAt: { lte: now } }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + 5 * 60_000) } });
    if (!lease.count) continue;
    try {
      const result = await send({ to: notification.recipient, subject: notification.subject, text: notification.text, from: process.env.AFFILIATE_EMAIL_FROM ?? "partners@sim.africa", idempotencyKey: notification.idempotencyKey, timeoutMs: 8000 });
      if (!result.skipped && result.id) {
        await db.affiliateNotification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
        sent++;
      }
    } catch { console.error("affiliate.notification.retry_required", { notificationId: notification.id }); }
  }
  return { sent, pending: notifications.length - sent };
}
