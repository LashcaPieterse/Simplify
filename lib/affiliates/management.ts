import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { affiliateTransaction, auditAffiliate } from "./accounting";
import { getAffiliateProgram } from "./program";
import { canRememberReferral } from "./referral";
import { percentageToBps, TERMS_VERSION } from "./rules";
import { queueAffiliateNotification } from "./notifications";

const applicationSchema = z.object({
  legalName: z.string().trim().min(2).max(160), publicName: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100), contactEmail: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(50), businessName: z.string().trim().max(160).optional(),
  promotion: z.string().trim().min(20).max(2000), terms: z.literal("on"), website: z.string().max(0).optional(),
});

export async function applyToAffiliateProgram(userId: string, raw: unknown, db: PrismaClient = prisma) {
  const program = await getAffiliateProgram(db);
  if (!program?.enabled || !program.defaultRateBps) throw new Error("Affiliate applications are not open yet.");
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues.some(issue => issue.path[0] === "terms") ? "Please accept the affiliate terms." : "Complete all application fields. Tell us how you will promote SIM.Africa in at least 20 characters.");
  const { legalName, publicName, country, contactEmail, phone, businessName, promotion } = parsed.data;
  return affiliateTransaction(db, async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const existing = await tx.affiliateProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    const profile = await tx.affiliateProfile.create({ data: {
      userId, code: randomBytes(6).toString("hex").toUpperCase(), legalName, publicName, country,
      contactEmail: contactEmail.toLowerCase(), phone, businessName: businessName || null, promotion,
      termsVersion: TERMS_VERSION,
    } });
    await queueAffiliateNotification(tx, profile.id, `affiliate-application:${profile.id}`, user.email, "We received your SIM.Africa guide application", `Hello ${publicName},\n\nYour guide application is awaiting review. We will email you when it is approved. Your links become active only after approval and email verification.\n\nView your status in your SIM.Africa account under Guide earnings.`);
    const recipient = process.env.AFFILIATE_APPLICATIONS_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim();
    if (recipient) await queueAffiliateNotification(tx, profile.id, `affiliate-review:${profile.id}`, recipient, "New SIM.Africa guide application", `A new guide application is awaiting review.\n\nApplication: ${profile.id}\nCountry: ${country}\n\nReview it in Admin → Affiliates.`);
    return profile;
  });
}

export async function saveAffiliateSettings(input: { enabled: boolean; percentage: string; actorEmail: string }, db: PrismaClient = prisma) {
  const defaultRateBps = percentageToBps(input.percentage, !input.enabled);
  if (input.enabled && !canRememberReferral()) throw new Error("Configure AFFILIATE_REFERRAL_SECRET with at least 32 characters before opening the program.");
  return affiliateTransaction(db, async tx => {
    const settings = await tx.affiliateProgramSettings.upsert({ where: { id: "program" }, create: { enabled: input.enabled, defaultRateBps }, update: { enabled: input.enabled, defaultRateBps } });
    await auditAffiliate(tx, input.actorEmail, "settings_updated", "program", { enabled: input.enabled, defaultRateBps });
    return settings;
  });
}

export async function reviewAffiliate(input: { id: string; status: string; rateOverride: string; reason: string; actorEmail: string }, db: PrismaClient = prisma) {
  if (!["pending", "approved", "rejected", "suspended"].includes(input.status)) throw new Error("Choose a valid guide status.");
  if (["rejected", "suspended"].includes(input.status) && !input.reason.trim()) throw new Error("Enter a reason for rejecting or suspending a guide.");
  const rateOverrideBps = percentageToBps(input.rateOverride, true);
  return affiliateTransaction(db, async tx => {
    const profile = await tx.affiliateProfile.findUniqueOrThrow({ where: { id: input.id }, include: { user: { select: { email: true, emailVerifiedAt: true } } } });
    const program = await tx.affiliateProgramSettings.findUnique({ where: { id: "program" } });
    if (input.status === "approved" && (!profile.user.emailVerifiedAt || !program?.defaultRateBps)) throw new Error("Approval requires a verified account email and a configured default commission rate.");
    const updated = await tx.affiliateProfile.update({ where: { id: input.id }, data: { status: input.status, rateOverrideBps, statusReason: input.reason.trim() || null } });
    await auditAffiliate(tx, input.actorEmail, "guide_reviewed", profile.id, { beforeStatus: profile.status, status: input.status, rateOverrideBps, reason: input.reason });
    if (input.status === "approved" && profile.status !== "approved") {
      await queueAffiliateNotification(tx, profile.id, `affiliate-approved:${profile.id}:${updated.updatedAt.toISOString()}`, profile.user.email, "Your SIM.Africa guide account is approved", `Hello ${profile.publicName},\n\nYour guide account is approved. Your current commission is ${(rateOverrideBps ?? program!.defaultRateBps!) / 100}% of eligible eSIM sales and future top-ups on those eSIMs.\n\nOpen Guide earnings in your SIM.Africa account for your link, QR code, and referral code. Earnings become available 30 days after confirmed fulfilment. Payouts are arranged monthly and payment instructions are agreed directly with us.`);
    }
    return updated;
  });
}

export function parseRefundAmount(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive refund amount with at most two decimals.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0 || cents > 2147483647) throw new Error("Refund amount is outside the supported range.");
  return cents;
}
