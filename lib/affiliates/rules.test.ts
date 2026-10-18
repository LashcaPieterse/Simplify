import assert from "node:assert/strict";
import test from "node:test";
import { commissionAmount, refundCommission, percentageToBps, safeReferralDestination, isSelfReferral, csvCell, DAY_MS } from "./rules";
import { readReferral, signReferral } from "./referral";
import { affiliateBalances } from "./payouts";
import { resolveCheckoutReferral } from "./program";
import type { PrismaClient } from "@prisma/client";

test("commission uses exact half-up rounding and cumulative refund deductions", () => {
  assert.equal(commissionAmount(2000, 1000), 200);
  assert.equal(commissionAmount(1, 5000), 1);
  assert.equal(commissionAmount(2147483647, 10000), 2147483647);
  assert.equal(refundCommission(1001, 3333, 1001), commissionAmount(1001, 3333));
  let deductions = 0;
  for (let refunded = 1; refunded <= 101; refunded++) deductions += refundCommission(101, 1250, refunded) - refundCommission(101, 1250, refunded - 1);
  assert.equal(deductions, commissionAmount(101, 1250));
  assert.throws(() => refundCommission(100, 1000, 101), /exceeds/);
  assert.throws(() => commissionAmount(100, 0));
  assert.equal(percentageToBps("12.34"), 1234);
  assert.equal(percentageToBps("", true), null);
  assert.throws(() => percentageToBps("1.001"));
});

test("signed referral expires at thirty days and rejects tampering or a future issue date", () => {
  const previous = process.env.AFFILIATE_REFERRAL_SECRET;
  process.env.AFFILIATE_REFERRAL_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  try {
    const now = Date.now();
    const token = signReferral("ABCDEF123456", now);
    assert.equal(readReferral(token, now), "ABCDEF123456");
    assert.equal(readReferral(token, now + 30 * DAY_MS - 1), "ABCDEF123456");
    assert.equal(readReferral(token, now + 30 * DAY_MS), null);
    assert.equal(readReferral(token, now - 1), null);
    assert.equal(readReferral(`${token}x`, now), null);
    assert.equal(readReferral(`x${token}`, now), null);
    assert.equal(readReferral(signReferral("123456ABCDEF", now), now), "123456ABCDEF");
  } finally { if (previous === undefined) delete process.env.AFFILIATE_REFERRAL_SECRET; else process.env.AFFILIATE_REFERRAL_SECRET = previous; }
});

test("referral destinations reject private paths, external redirects, encodings, and backslashes", () => {
  assert.equal(safeReferralDestination("/country/namibia"), "/country/namibia");
  assert.equal(safeReferralDestination("/"), "/");
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/%2fevil", "/admin", "/api/orders", "/orders/private", "/auth/signin", "/country/../../admin"]) assert.equal(safeReferralDestination(path), "/destinations");
  assert.equal(safeReferralDestination("/country/namibia?next=https://evil.example"), "/country/namibia");
  assert.equal(isSelfReferral({ userId: "guide", userEmail: "GUIDE@EXAMPLE.COM" }, { email: " guide@example.com " }), true);
  assert.equal(isSelfReferral({ userId: "guide", userEmail: "guide@example.com" }, { userId: "guide" }), true);
  assert.equal(csvCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"');
});

test("balances separate currencies, maturity, holds, reservations, refunds, and paid allocations", () => {
  const now = new Date();
  const entry = (amountCents: number, currency = "USD") => ({ amountCents, currency, availableAt: new Date(0), commission: { onHold: false }, allocations: [] as Array<{ releasedAt: Date | null; payout: { status: string } }> });
  const pending = { ...entry(200), availableAt: new Date(now.getTime() + DAY_MS) };
  const held = { ...entry(50), commission: { onHold: true } };
  const reserved = { ...entry(400), allocations: [{ releasedAt: null, payout: { status: "processing" } }] };
  const paid = { ...entry(300), allocations: [{ releasedAt: null, payout: { status: "paid" } }] };
  const released = { ...entry(100), allocations: [{ releasedAt: now, payout: { status: "cancelled" } }] };
  assert.deepEqual(affiliateBalances([entry(100), entry(-25), pending, held, reserved, paid, released, entry(1000, "NAD")], now), [
    { currency: "USD", pending: 250, available: 175, reserved: 400, paid: 300 },
    { currency: "NAD", pending: 0, available: 1000, reserved: 0, paid: 0 },
  ]);
});

test("manual codes override cookies; inactive and self referrals cannot earn", async () => {
  const flag = process.env.AFFILIATE_PROGRAM_ENABLED;
  const secret = process.env.AFFILIATE_REFERRAL_SECRET;
  process.env.AFFILIATE_PROGRAM_ENABLED = "true";
  process.env.AFFILIATE_REFERRAL_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  const profile = { id: "guide-id", code: "ABCDEF123456", userId: "guide-user", contactEmail: "guide@example.com", status: "approved", rateOverrideBps: 1250, user: { email: "guide@example.com", emailVerifiedAt: new Date() } };
  const db = { affiliateProgramSettings: { findUnique: async () => ({ enabled: true, defaultRateBps: 1000 }) }, affiliateProfile: { findUnique: async ({ where }: { where: { code: string } }) => where.code === profile.code ? profile : null } } as unknown as PrismaClient;
  try {
    const token = signReferral("999999999999");
    assert.deepEqual(await resolveCheckoutReferral({ affiliateCode: "abcdef123456", referralToken: token, customerEmail: "traveller@example.com" }, db), { affiliateId: "guide-id", affiliateCode: profile.code, affiliateRateBps: 1250, affiliateSource: "code" });
    assert.deepEqual(await resolveCheckoutReferral({ referralToken: signReferral(profile.code), customerEmail: "traveller@example.com" }, db), { affiliateId: "guide-id", affiliateCode: profile.code, affiliateRateBps: 1250, affiliateSource: "cookie" });
    await assert.rejects(resolveCheckoutReferral({ affiliateCode: "INVALID00000" }, db), /invalid or inactive/);
    await assert.rejects(resolveCheckoutReferral({ affiliateCode: profile.code, customerEmail: "GUIDE@EXAMPLE.COM" }, db), /own purchases/);
    assert.deepEqual(await resolveCheckoutReferral({ affiliateCode: profile.code, intent: "top-up" }, db), {});
    profile.status = "suspended";
    assert.deepEqual(await resolveCheckoutReferral({ referralToken: signReferral(profile.code) }, db), {});
    await assert.rejects(resolveCheckoutReferral({ affiliateCode: profile.code }, db), /invalid or inactive/);
  } finally {
    if (flag === undefined) delete process.env.AFFILIATE_PROGRAM_ENABLED; else process.env.AFFILIATE_PROGRAM_ENABLED = flag;
    if (secret === undefined) delete process.env.AFFILIATE_REFERRAL_SECRET; else process.env.AFFILIATE_REFERRAL_SECRET = secret;
  }
});

test("top-ups retain the original eSIM's guide and current rate without browser attribution", async () => {
  const previous = { flag: process.env.AFFILIATE_PROGRAM_ENABLED, secret: process.env.AFFILIATE_REFERRAL_SECRET };
  process.env.AFFILIATE_PROGRAM_ENABLED = "true";
  process.env.AFFILIATE_REFERRAL_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  const program = { enabled: true, defaultRateBps: 1000 };
  const guide = { id: "original-guide", code: "ABCDEF123456", userId: "guide-user", contactEmail: "contact@example.com", status: "approved", rateOverrideBps: 1250 as number | null, user: { email: "guide@example.com", emailVerifiedAt: new Date() as Date | null } };
  const original = { checkout: { intent: "purchase", affiliateId: guide.id as string | null } };
  const db = {
    affiliateProgramSettings: { findUnique: async () => program },
    esimOrder: { findFirst: async ({ where }: { where: { id: string; userId: string; profiles: { some: { iccid: string } } } }) => where.id === "original-order" && ["traveller", "guide-user"].includes(where.userId) && where.profiles.some.iccid === "original-iccid" ? original : null },
    affiliateProfile: { findUnique: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, guide.id); return guide; } },
  } as unknown as PrismaClient;
  const input = { intent: "top-up", userId: "traveller", customerEmail: "traveller@example.com", topUpForOrderId: "original-order", topUpForIccid: "original-iccid" };
  const expected = { affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: 1250, affiliateSource: "original-order" };
  try {
    assert.deepEqual(await resolveCheckoutReferral(input, db), expected, "top-ups work without cookies or codes");
    assert.deepEqual(await resolveCheckoutReferral({ ...input, referralToken: signReferral("999999999999", Date.now() - 31 * DAY_MS), affiliateCode: "999999999999" }, db), expected, "expired cookies and another guide's code cannot change the original guide");
    guide.rateOverrideBps = null;
    assert.equal((await resolveCheckoutReferral(input, db)).affiliateRateBps, 1000);
    program.defaultRateBps = 1500;
    assert.equal((await resolveCheckoutReferral(input, db)).affiliateRateBps, 1500);
    for (const changes of [{ userId: undefined }, { userId: "another-owner" }, { topUpForOrderId: "another-order" }, { topUpForIccid: "another-iccid" }, { userId: "guide-user" }, { customerEmail: " GUIDE@EXAMPLE.COM " }, { customerEmail: "CONTACT@EXAMPLE.COM" }]) {
      assert.deepEqual(await resolveCheckoutReferral({ ...input, ...changes }, db), {});
    }
    original.checkout.affiliateId = null;
    assert.deepEqual(await resolveCheckoutReferral({ ...input, affiliateCode: guide.code }, db), {}, "an unreferenced eSIM cannot be retroactively attributed");
    original.checkout.affiliateId = guide.id;
    original.checkout.intent = "top-up";
    assert.deepEqual(await resolveCheckoutReferral(input, db), {});
    original.checkout.intent = "purchase";
    guide.status = "suspended";
    assert.deepEqual(await resolveCheckoutReferral(input, db), {});
    guide.status = "approved"; guide.user.emailVerifiedAt = null;
    assert.deepEqual(await resolveCheckoutReferral(input, db), {});
    guide.user.emailVerifiedAt = new Date(); program.enabled = false;
    assert.deepEqual(await resolveCheckoutReferral(input, db), {});
    program.enabled = true; process.env.AFFILIATE_PROGRAM_ENABLED = "false";
    assert.deepEqual(await resolveCheckoutReferral(input, db), {});
  } finally {
    if (previous.flag === undefined) delete process.env.AFFILIATE_PROGRAM_ENABLED; else process.env.AFFILIATE_PROGRAM_ENABLED = previous.flag;
    if (previous.secret === undefined) delete process.env.AFFILIATE_REFERRAL_SECRET; else process.env.AFFILIATE_REFERRAL_SECRET = previous.secret;
  }
});
