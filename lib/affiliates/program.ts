import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { CheckoutRequestError } from "../payments/checkout-request";
import { affiliateInfrastructureEnabled, readReferral } from "./referral";
import { isSelfReferral, normalizeAffiliateCode } from "./rules";

export async function getAffiliateProgram(db: PrismaClient = prisma) {
  if (!affiliateInfrastructureEnabled()) return null;
  return db.affiliateProgramSettings.findUnique({ where: { id: "program" } });
}

export async function findPublicGuide(code: string, db: PrismaClient = prisma) {
  const program = await getAffiliateProgram(db);
  if (!program?.enabled || !program.defaultRateBps) return null;
  return db.affiliateProfile.findFirst({
    where: { code: normalizeAffiliateCode(code), status: "approved", user: { emailProofAt: { not: null } } },
    select: { code: true, publicName: true },
  });
}

export async function resolveCheckoutReferral(input: {
  affiliateCode?: string;
  referralToken?: string | null;
  userId?: string | null;
  customerEmail?: string | null;
  intent?: string;
  topUpForOrderId?: string;
  topUpForIccid?: string;
}, db: PrismaClient = prisma) {
  if (input.intent === "top-up") return resolveTopUpReferral(input, db);
  const explicit = input.affiliateCode?.trim();
  const code = explicit ? normalizeAffiliateCode(explicit) : readReferral(input.referralToken);
  if (!code) return {};
  const program = await getAffiliateProgram(db);
  if (!program?.enabled || !program.defaultRateBps) {
    if (explicit) throw new CheckoutRequestError("Affiliate referrals are currently unavailable.", 422, "affiliateCode");
    return {};
  }
  const guide = await db.affiliateProfile.findUnique({ where: { code }, include: { user: { select: { email: true, emailProofAt: true } } } });
  if (!guide || guide.status !== "approved" || !guide.user.emailProofAt) {
    if (explicit) throw new CheckoutRequestError("This referral code is invalid or inactive.", 422, "affiliateCode");
    return {};
  }
  if (isSelfReferral({ userId: guide.userId, userEmail: guide.user.email }, { userId: input.userId, email: input.customerEmail }) || isSelfReferral({ userId: guide.userId, userEmail: guide.contactEmail }, { userId: input.userId, email: input.customerEmail })) {
    if (explicit) throw new CheckoutRequestError("Your own purchases cannot earn referral commission.", 422, "affiliateCode");
    return {};
  }
  return {
    affiliateId: guide.id,
    affiliateCode: guide.code,
    affiliateRateBps: guide.rateOverrideBps ?? program.defaultRateBps,
    affiliateSource: explicit ? "code" : "cookie",
  };
}

/** Top-ups inherit the original eSIM's guide, independently of browser referrals. */
async function resolveTopUpReferral(input: {
  userId?: string | null;
  customerEmail?: string | null;
  topUpForOrderId?: string;
  topUpForIccid?: string;
}, db: PrismaClient) {
  if (!input.userId || !input.topUpForOrderId || !input.topUpForIccid) return {};
  const program = await getAffiliateProgram(db);
  if (!program?.enabled || !program.defaultRateBps) return {};
  const original = await db.esimOrder.findFirst({
    where: { id: input.topUpForOrderId, userId: input.userId, profiles: { some: { iccid: input.topUpForIccid } } },
    select: { checkout: { select: { intent: true, affiliateId: true } }, saleCheckout: { select: { intent: true, affiliateId: true } } },
  });
  const sale = original?.saleCheckout ?? original?.checkout;
  if (sale?.intent !== "purchase" || !sale.affiliateId) return {};
  const guide = await db.affiliateProfile.findUnique({ where: { id: sale.affiliateId }, include: { user: { select: { email: true, emailProofAt: true } } } });
  if (!guide || guide.status !== "approved" || !guide.user.emailProofAt) return {};
  if (isSelfReferral({ userId: guide.userId, userEmail: guide.user.email }, { userId: input.userId, email: input.customerEmail }) || isSelfReferral({ userId: guide.userId, userEmail: guide.contactEmail }, { userId: input.userId, email: input.customerEmail })) return {};
  return { affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: guide.rateOverrideBps ?? program.defaultRateBps, affiliateSource: "original-order" };
}
