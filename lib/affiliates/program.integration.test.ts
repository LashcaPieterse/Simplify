import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import type { AiraloClient } from "../airalo/client";
import { OrderResponseSchema } from "../airalo/schemas";
import { createCheckout, verifyPaymentTransaction } from "../payments/checkouts";
import { applyToAffiliateProgram, reviewAffiliate, saveAffiliateSettings } from "./management";
import { accrueCommissionForOrder, reconcileAffiliateCommissions, recordAffiliateRefund, recordAffiliateSaleRefund, setCommissionHold, stampAffiliateFulfilment } from "./accounting";
import { prepareAffiliatePayout, transitionAffiliatePayout } from "./payouts";
import { deliverAffiliateNotifications } from "./notifications";
import { getGuideDashboard } from "./queries";
import { signReferral } from "./referral";
import { DAY_MS } from "./rules";

test("affiliate sandbox: additive migrations, purchases and top-ups, commissions, refunds, payouts and access isolation", { timeout: 120000 }, async t => {
  // This test never reads DATABASE_URL: both the database and provider adapters are isolated fixtures.
  const directory = mkdtempSync(join(tmpdir(), "sim-africa-affiliates-"));
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const resources: { db?: PrismaClient } = {};
  const overrides: Record<string, string> = { AFFILIATE_PROGRAM_ENABLED: "true", AFFILIATE_REFERRAL_SECRET: "isolated-test-referral-secret-at-least-32-characters", RESEND_API_KEY: "", ADMIN_EMAIL: "admin@example.test", AIRALO_BRAND_SETTINGS_NAME: "" };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  t.after(async () => {
    if (resources.db) await resources.db.$disconnect();
    await server.stop(); await sql.close(); rmSync(directory, { recursive: true, force: true });
    for (const key of Object.keys(overrides)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  });
  // Derive the pre-affiliate schema from the unrelated current models, then apply the actual additive migration.
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
    .replace(/^model Affiliate[\s\S]*?^}\s*/gm, "")
    .replace(/^\s+(?:affiliate\w*|fulfilledAt)\s+[^\n]*\n/gm, "")
    .replace(/^\s*@@index\(\[affiliateId, createdAt\]\)\s*$/gm, "");
  const baseline = join(directory, "before.prisma");
  writeFileSync(baseline, schema);
  const diff = spawnSync(process.execPath, [fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "diff", "--from-empty", "--to-schema-datamodel", baseline, "--script"], { encoding: "utf8" });
  assert.equal(diff.status, 0, diff.stderr);
  await sql.exec(diff.stdout);
  await sql.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await sql.exec(readFileSync(new URL("../../prisma/migrations/20261018120000_add_affiliate_program/migration.sql", import.meta.url), "utf8"));
  await sql.exec(readFileSync(new URL("../../prisma/migrations/20261018183000_add_affiliate_topup_commissions/migration.sql", import.meta.url), "utf8"));
  await server.start();
  const database = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30` } } });
  resources.db = database;
  const actorEmail = "admin@example.test";
  const user = await database.user.create({ data: { email: "guide@example.test", name: "Guide One" } });
  const traveller = await database.user.create({ data: { email: "traveller@example.test", emailVerifiedAt: new Date() } });
  const country = await database.country.create({ data: { countryCode: "NA", slug: "namibia", title: "Namibia" } });
  const operator = await database.operator.create({ data: { countryId: country.id, title: "Sandbox", info: [] } });
  const pkg = await database.package.create({ data: {
    operatorId: operator.id, airaloPackageId: "sandbox-1gb", type: "sim", title: "Namibia 1 GB", amount: 1024, data: "1 GB", day: 7,
    price: 20, netPrice: 10, pricesNetPrice: { USD: { amount: 10 } }, manualInstallation: "", qrInstallation: "",
    state: { create: { sellingPriceCents: 2000, basePriceCents: 1000, currencyCode: "USD", isActive: true, lastSyncedAt: new Date() } },
  } });
  await saveAffiliateSettings({ enabled: true, percentage: "10", actorEmail }, database);
  const guide = await applyToAffiliateProgram(user.id, { legalName: "Guide One", publicName: "Safari Guide", country: "Namibia", contactEmail: user.email, phone: "+264811234567", promotion: "I guide weekly tours throughout Namibia.", terms: "on", website: "" }, database);
  await assert.rejects(reviewAffiliate({ id: guide.id, status: "approved", rateOverride: "", reason: "", actorEmail }, database), /verified account email/);
  await database.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await reviewAffiliate({ id: guide.id, status: "approved", rateOverride: "", reason: "", actorEmail }, database);
  const sent: string[] = [];
  await deliverAffiliateNotifications(database, 10, async message => { sent.push(message.subject); return { skipped: false, id: "sandbox-email" }; });
  assert.equal(sent.length, 3);

  let supplierCalls = 0;
  let primaryCommissionId = "";
  let primaryAvailableAt = new Date();
  await t.test("guest checkout freezes attribution; verified payment and fulfilment earn once even after rate changes and suspension", async subtest => {
    subtest.mock.timers.enable({ apis: ["Date"], now: Date.now() - 40 * DAY_MS });
    const purchase = await createCheckout({ packageId: pkg.id, customerEmail: "traveller@example.test", metadata: { affiliateId: "forged", affiliateRateBps: 9999 } }, {
      prisma: database, baseUrl: "https://sandbox.example.test", referralToken: signReferral(guide.code),
      dpoClient: { createTransaction: async () => ({ token: "sandbox-dpo-token", redirectUrl: "https://sandbox.example.test/pay", rawResponse: {} }) },
    });
    const checkout = await database.checkoutSession.findUniqueOrThrow({ where: { id: purchase.checkoutId } });
    assert.equal(checkout.affiliateId, guide.id); assert.equal(checkout.affiliateRateBps, 1000); assert.equal(checkout.affiliateSource, "cookie");
    assert.equal(await database.affiliateCommission.count(), 0);
    // Claiming the guest order must not affect the frozen referral.
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { userId: traveller.id } });
    await saveAffiliateSettings({ enabled: true, percentage: "20", actorEmail }, database);
    await reviewAffiliate({ id: guide.id, status: "suspended", rateOverride: "25", reason: "Pause new referrals", actorEmail }, database);
    const payment = await database.paymentTransaction.findFirstOrThrow({ where: { checkoutId: checkout.id } });
    const airaloClient = { createOrderResponse: async () => { supplierCalls++; return OrderResponseSchema.parse({ status: true, data: { order_id: "SANDBOX-ORDER-1", order_reference: "SANDBOX-REF-1", status: "completed", iccid: "8900000000000000001", activation_code: "LPA:1$sandbox.example.test$activation" } }); } } as unknown as AiraloClient;
    const verification = { prisma: database, dpoClient: { verifyTransaction: async () => ({ status: "approved", resultCode: "000", amount: 20, currency: "USD", rawResponse: {} }) }, airaloOptions: { submissionMode: "sync" as const, airaloClient } };
    await verifyPaymentTransaction(payment.id, { ...verification, dpoClient: { verifyTransaction: async () => ({ status: "approved", resultCode: "000", amount: 19, currency: "USD", rawResponse: {} }) } });
    assert.equal(await database.affiliateCommission.count(), 0); assert.equal(supplierCalls, 0);
    const result = await verifyPaymentTransaction(payment.id, verification);
    assert.ok(result.orderId);
    const commission = await database.affiliateCommission.findUniqueOrThrow({ where: { checkoutId: checkout.id } });
    primaryCommissionId = commission.id; primaryAvailableAt = commission.availableAt;
    assert.equal(commission.commissionCents, 200); assert.equal(commission.rateBps, 1000);
    assert.equal(commission.availableAt.getTime() - commission.fulfilledAt.getTime(), 30 * DAY_MS);
    await verifyPaymentTransaction(payment.id, verification);
    await accrueCommissionForOrder(result.orderId!, database, new Date(Date.now() + DAY_MS));
    assert.equal(supplierCalls, 1); assert.equal(await database.affiliateCommission.count(), 1); assert.equal(await database.affiliateLedgerEntry.count(), 1);
    const repeated = await database.affiliateCommission.findUniqueOrThrow({ where: { id: commission.id } });
    assert.equal(repeated.availableAt.getTime(), commission.availableAt.getTime());
    await assert.rejects(prepareAffiliatePayout(guide.id, "USD", actorEmail, database), /no positive available balance/);
  });

  await t.test("concurrent preparation reserves earnings once; allocations and original terms are protected by PostgreSQL", async () => {
    const attempts = await Promise.allSettled([prepareAffiliatePayout(guide.id, "USD", actorEmail, database, new Date(primaryAvailableAt.getTime() + 1)), prepareAffiliatePayout(guide.id, "USD", actorEmail, database, new Date(primaryAvailableAt.getTime() + 1))]);
    assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
    const payout = await database.affiliatePayout.findFirstOrThrow({ where: { affiliateId: guide.id, status: "prepared" } });
    const allocation = await database.affiliatePayoutAllocation.findFirstOrThrow({ where: { payoutId: payout.id } });
    await assert.rejects(sql.query('INSERT INTO "AffiliatePayoutAllocation" (id, "payoutId", "ledgerEntryId") VALUES ($1, $2, $3)', ["duplicate-allocation", payout.id, allocation.ledgerEntryId]), /unique/);
    await assert.rejects(sql.query('UPDATE "AffiliateLedgerEntry" SET "amountCents"=999 WHERE id=$1', [allocation.ledgerEntryId]), /append-only/);
    await assert.rejects(sql.query('UPDATE "AffiliateCommission" SET "rateBps"=2500 WHERE id=$1', [primaryCommissionId]), /immutable/);
    const commission = await database.affiliateCommission.findUniqueOrThrow({ where: { id: primaryCommissionId } });
    await assert.rejects(sql.query('UPDATE "CheckoutSession" SET "affiliateRateBps"=2500 WHERE id=$1', [commission.checkoutId]), /immutable/);
    await transitionAffiliatePayout({ id: payout.id, action: "processing", actorEmail }, database);
    await assert.rejects(transitionAffiliatePayout({ id: payout.id, action: "cancelled", actorEmail, note: "uncertain" }, database), /Confirm no money/);
    const settlement = { id: payout.id, action: "paid" as const, actorEmail, transferReference: "BANK-SANDBOX-1", paidAt: new Date().toISOString(), transferAmount: "2", transferCurrency: "USD", exchangeRate: "1", fees: "0" };
    await transitionAffiliatePayout(settlement, database); await transitionAffiliatePayout(settlement, database);
    assert.equal((await database.affiliatePayout.findUniqueOrThrow({ where: { id: payout.id } })).status, "paid");
    await assert.rejects(transitionAffiliatePayout({ ...settlement, action: "cancelled", note: "undo", confirmedNotSent: true }, database));
  });

  await t.test("partial refunds are idempotent, capped, and deducted from future earnings after payout", async () => {
    const refund = { commissionId: primaryCommissionId, saleRefundCents: 500, reference: "refund-1", reason: "Partial refund", actorEmail };
    await recordAffiliateRefund(refund, database); await recordAffiliateRefund(refund, database);
    await recordAffiliateRefund({ ...refund, saleRefundCents: 500, reference: "refund-2" }, database);
    assert.equal((await database.affiliateCommission.findUniqueOrThrow({ where: { id: primaryCommissionId } })).refundedSaleCents, 1000);
    assert.equal((await database.affiliateLedgerEntry.aggregate({ where: { kind: "refund" }, _sum: { amountCents: true } }))._sum.amountCents, -100);
    await assert.rejects(recordAffiliateRefund({ ...refund, saleRefundCents: 1500, reference: "refund-too-much" }, database), /exceeds/);
    await assert.rejects(recordAffiliateRefund({ ...refund, saleRefundCents: 700 }, database), /different amount/);
    const dashboard = await getGuideDashboard(user.id, database);
    assert.equal(dashboard!.balances[0].available, -100); assert.equal(dashboard!.balances[0].paid, 200);
    await assert.rejects(prepareAffiliatePayout(guide.id, "NAD", actorEmail, database), /no positive available balance/);
  });

  let fixtureCounter = 1;
  await t.test("a refund before supplier fulfilment is carried into the eventual commission", async () => {
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, totalCents: 2000, currency: "USD", affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: 1000, affiliateSource: "code" } });
    const refund = { checkoutId: checkout.id, saleRefundCents: 2000, reference: "pre-delivery-refund", reason: "Undelivered purchase refunded", actorEmail };
    await recordAffiliateSaleRefund(refund, database); await recordAffiliateSaleRefund(refund, database);
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", amountCents: 2000, currency: "USD", status: "approved" } });
    const order = await database.esimOrder.create({ data: { packageId: pkg.id, status: "completed", orderNumber: "REFUNDED-BEFORE-DELIVERY", paymentTransactionId: payment.id, profiles: { create: { iccid: "8900000000000099999", status: "completed", activationCode: "sandbox" } }, installation: { create: { payload: JSON.stringify({ activationCode: "sandbox" }) } } } });
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
    const commission = await accrueCommissionForOrder(order.id, database);
    assert.equal(commission!.refundedSaleCents, 2000);
    assert.equal((await database.affiliateLedgerEntry.aggregate({ where: { commissionId: commission!.id }, _sum: { amountCents: true } }))._sum.amountCents, 0);
    const dashboard = await getGuideDashboard(user.id, database);
    assert.equal(dashboard!.balances.find(balance => balance.currency === "USD")!.pending, 0, "a refunded pending commission cancels itself without reducing other available earnings");
  });
  async function delayedOrder(currency = "USD") {
    fixtureCounter++;
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, totalCents: 2000, currency, affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: 1000, affiliateSource: "code" } });
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", amountCents: 2000, currency, status: "pending" } });
    const order = await database.esimOrder.create({ data: { packageId: pkg.id, status: "pending", paymentTransactionId: payment.id } });
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
    const fulfilledAt = new Date(Date.now() - 40 * DAY_MS);
    await database.$transaction(async tx => {
      await tx.esimOrder.update({ where: { id: order.id }, data: { status: "completed", orderNumber: `FIXTURE-${fixtureCounter}` } });
      await tx.esimProfile.create({ data: { orderId: order.id, iccid: `89000000000000000${fixtureCounter.toString().padStart(2, "0")}`, status: "completed", activationCode: "sandbox-activation" } });
      await tx.esimInstallationPayload.create({ data: { orderId: order.id, payload: JSON.stringify({ activationCode: "sandbox-activation" }) } });
      await stampAffiliateFulfilment(tx, order.id, fulfilledAt);
    });
    assert.equal(await accrueCommissionForOrder(order.id, database), null, "supplier delivery alone cannot earn commission");
    await database.paymentTransaction.update({ where: { id: payment.id }, data: { status: "approved" } });
    return { checkout, payment, order };
  }
  await t.test("recovery repairs delayed postings; review holds and cancellation preserve balances", async () => {
    const fixture = await delayedOrder();
    await reconcileAffiliateCommissions(database);
    const commission = await database.affiliateCommission.findUniqueOrThrow({ where: { checkoutId: fixture.checkout.id } });
    await setCommissionHold(commission.id, true, "Review", actorEmail, database);
    await assert.rejects(prepareAffiliatePayout(guide.id, "USD", actorEmail, database), /no positive/);
    await setCommissionHold(commission.id, false, "Cleared", actorEmail, database);
    const payout = await prepareAffiliatePayout(guide.id, "USD", actorEmail, database);
    assert.equal(payout.amountCents, 100, "past refund reduces the next payout");
    await recordAffiliateRefund({ commissionId: commission.id, saleRefundCents: 500, reference: "pending-refund", reason: "Refund after export", actorEmail }, database);
    assert.equal((await database.affiliatePayout.findUniqueOrThrow({ where: { id: payout.id } })).status, "cancelled");
    const replacement = await prepareAffiliatePayout(guide.id, "USD", actorEmail, database);
    assert.equal(replacement.amountCents, 50);
    await transitionAffiliatePayout({ id: replacement.id, action: "cancelled", actorEmail, note: "Guide requested deferral" }, database);
    const nad = await delayedOrder("NAD"); await accrueCommissionForOrder(nad.order.id, database);
    const foreign = await prepareAffiliatePayout(guide.id, "NAD", actorEmail, database);
    assert.equal(foreign.amountCents, 200);
    assert.equal((await getGuideDashboard(traveller.id, database)), null, "travellers cannot read another guide's account");
    const dto = JSON.stringify((await getGuideDashboard(user.id, database))!.commissions);
    assert.doesNotMatch(dto, /traveller@example|activation|iccid|customerEmail/);
    await saveAffiliateSettings({ enabled: false, percentage: "20", actorEmail }, database);
    assert.ok(await getGuideDashboard(user.id, database), "closing new referrals preserves accounting access");
  });

  let topUpCommissionId = "";
  let topUpAvailableAt = new Date();
  await t.test("top-ups credit the original guide after cookie expiry, with their own frozen rate and fulfilment", async () => {
    await saveAffiliateSettings({ enabled: true, percentage: "20", actorEmail }, database);
    await reviewAffiliate({ id: guide.id, status: "approved", rateOverride: "12.5", reason: "", actorEmail }, database);
    const originalCommission = await database.affiliateCommission.findUniqueOrThrow({ where: { id: primaryCommissionId } });
    const original = await database.esimOrder.findUniqueOrThrow({ where: { id: originalCommission.orderId }, include: { profiles: true } });
    assert.equal(original.userId, traveller.id);
    assert.ok(originalCommission.fulfilledAt.getTime() < Date.now() - 30 * DAY_MS);
    const iccid = original.profiles[0].iccid!;
    const topUpPackage = await database.package.create({ data: {
      operatorId: operator.id, airaloPackageId: "sandbox-1gb-topup", type: "topup", title: "Namibia 1 GB top-up", amount: 1024, data: "1 GB", day: 7,
      price: 10.04, netPrice: 5, pricesNetPrice: { USD: { amount: 5 } }, manualInstallation: "", qrInstallation: "",
      state: { create: { sellingPriceCents: 1004, basePriceCents: 500, currencyCode: "USD", isActive: true, lastSyncedAt: new Date() } },
    } });
    const profileCount = await database.esimProfile.count();
    const topUp = await createCheckout({ packageId: topUpPackage.id, customerEmail: traveller.email, intent: "top-up", topUpForOrderId: original.id, topUpForIccid: iccid, affiliateCode: "999999999999", metadata: { affiliateId: "forged", affiliateRateBps: 9999 } }, {
      prisma: database, baseUrl: "https://sandbox.example.test", userId: traveller.id, referralToken: signReferral("999999999999", Date.now() - 40 * DAY_MS),
      dpoClient: { createTransaction: async () => ({ token: "sandbox-topup-token", redirectUrl: "https://sandbox.example.test/pay", rawResponse: {} }) },
    });
    const checkout = await database.checkoutSession.findUniqueOrThrow({ where: { id: topUp.checkoutId } });
    assert.equal(checkout.affiliateId, guide.id); assert.equal(checkout.affiliateSource, "original-order"); assert.equal(checkout.affiliateRateBps, 1250);
    await assert.rejects(sql.query('UPDATE "CheckoutSession" SET "topUpForIccid"=$1 WHERE id=$2', ["another-iccid", checkout.id]), /immutable/);
    const payment = await database.paymentTransaction.findFirstOrThrow({ where: { checkoutId: checkout.id } });
    let topUpCalls = 0;
    const airaloClient = { createTopUpOrderResponse: async (payload: { iccid: string }) => {
      topUpCalls++; assert.equal(payload.iccid, iccid);
      return OrderResponseSchema.parse({ data: { id: 12345, code: "SANDBOX-TOPUP-1", package_id: topUpPackage.airaloPackageId, quantity: 1, type: "topup", description: `Topup (${iccid})`, currency: "USD", price: 5 } });
    } } as unknown as AiraloClient;
    const verification = { prisma: database, dpoClient: { verifyTransaction: async () => ({ status: "approved", resultCode: "000", amount: 10.04, currency: "USD", rawResponse: {} }) }, airaloOptions: { airaloClient } };
    await verifyPaymentTransaction(payment.id, { ...verification, dpoClient: { verifyTransaction: async () => ({ status: "approved", resultCode: "000", amount: 10.04, currency: "NAD", rawResponse: {} }) } });
    assert.equal(topUpCalls, 0); assert.equal(await database.affiliateCommission.count({ where: { checkoutId: checkout.id } }), 0);
    // Changes after checkout creation cannot erase or reprice this top-up's obligation.
    await reviewAffiliate({ id: guide.id, status: "suspended", rateOverride: "30", reason: "Pause future referrals", actorEmail }, database);
    await saveAffiliateSettings({ enabled: false, percentage: "25", actorEmail }, database);
    const result = await verifyPaymentTransaction(payment.id, verification);
    assert.ok(result.orderId);
    const order = await database.esimOrder.findUniqueOrThrow({ where: { id: result.orderId! }, include: { profiles: true, installation: true } });
    assert.equal(order.status, "completed"); assert.ok(order.fulfilledAt);
    assert.equal(order.profiles.length, 0); assert.equal(order.installation, null);
    assert.equal(await database.esimProfile.count(), profileCount, "a top-up must not create another SIM");
    const commission = await database.affiliateCommission.findUniqueOrThrow({ where: { checkoutId: checkout.id } });
    topUpCommissionId = commission.id; topUpAvailableAt = commission.availableAt;
    assert.equal(commission.saleCents, 1004); assert.equal(commission.commissionCents, 126); assert.equal(commission.rateBps, 1250);
    assert.equal(commission.fulfilledAt.getTime(), order.fulfilledAt!.getTime());
    assert.equal(commission.availableAt.getTime() - commission.fulfilledAt.getTime(), 30 * DAY_MS);
    await verifyPaymentTransaction(payment.id, verification);
    await accrueCommissionForOrder(order.id, database, new Date(Date.now() + DAY_MS));
    assert.equal(topUpCalls, 1); assert.equal(await database.affiliateCommission.count({ where: { checkoutId: checkout.id } }), 1);
    assert.equal(await database.affiliateLedgerEntry.count({ where: { commissionId: commission.id } }), 1);
    assert.equal((await database.affiliateCommission.findUniqueOrThrow({ where: { id: commission.id } })).availableAt.getTime(), topUpAvailableAt.getTime());
    const dashboard = (await getGuideDashboard(user.id, database))!;
    assert.equal(dashboard.commissions.find(sale => sale.id === commission.id)!.checkout.intent, "top-up");
    assert.equal(dashboard.balances.find(balance => balance.currency === "USD")!.pending, 126);
  });

  await t.test("top-up earnings mature, enter manual payouts, and carry later refund deductions forward", async subtest => {
    subtest.mock.timers.enable({ apis: ["Date"], now: topUpAvailableAt.getTime() + 1 });
    const payout = await prepareAffiliatePayout(guide.id, "USD", actorEmail, database);
    assert.equal(payout.amountCents, 176, "mature top-up earnings join the existing fifty-cent available balance");
    assert.ok(await database.affiliatePayoutAllocation.findFirst({ where: { payoutId: payout.id, ledgerEntry: { commissionId: topUpCommissionId } } }));
    await transitionAffiliatePayout({ id: payout.id, action: "processing", actorEmail }, database);
    await transitionAffiliatePayout({ id: payout.id, action: "paid", actorEmail, transferReference: "BANK-TOPUP-1", paidAt: new Date().toISOString(), transferAmount: "1.76", transferCurrency: "USD", exchangeRate: "1", fees: "0" }, database);
    const adjustment = { commissionId: topUpCommissionId, saleRefundCents: 4, reference: "topup-partial-refund", reason: "Partial top-up refund", actorEmail };
    await recordAffiliateRefund(adjustment, database); await recordAffiliateRefund(adjustment, database);
    const commission = await database.affiliateCommission.findUniqueOrThrow({ where: { id: topUpCommissionId } });
    assert.equal(commission.refundedSaleCents, 4);
    assert.equal((await database.affiliateLedgerEntry.aggregate({ where: { commissionId: commission.id, kind: "refund" }, _sum: { amountCents: true } }))._sum.amountCents, -1);
    assert.equal((await getGuideDashboard(user.id, database))!.balances.find(balance => balance.currency === "USD")!.available, -1);
  });

  await t.test("top-up reconciliation repairs missing postings and refuses an unrelated SIM or unattributed legacy checkout", async () => {
    const originalCommission = await database.affiliateCommission.findUniqueOrThrow({ where: { id: primaryCommissionId } });
    const original = await database.esimOrder.findUniqueOrThrow({ where: { id: originalCommission.orderId }, include: { profiles: true } });
    async function completedTopUp(iccid: string, attributed = true) {
      fixtureCounter++;
      const checkout = await database.checkoutSession.create({ data: {
        packageId: pkg.id, userId: traveller.id, totalCents: 1000, currency: "USD", intent: "top-up", topUpForOrderId: original.id, topUpForIccid: iccid,
        ...(attributed ? { affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: 1250, affiliateSource: "original-order" } : {}),
      } });
      const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", amountCents: 1000, currency: "USD", status: "approved" } });
      const order = await database.esimOrder.create({ data: { packageId: pkg.id, userId: traveller.id, status: "completed", orderNumber: `RECOVERED-TOPUP-${fixtureCounter}`, paymentTransactionId: payment.id } });
      await database.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
      return { checkout, order };
    }
    const valid = await completedTopUp(original.profiles[0].iccid!);
    const wrongSim = await completedTopUp("unrelated-iccid");
    const legacy = await completedTopUp(original.profiles[0].iccid!, false);
    await assert.rejects(sql.query('INSERT INTO "CheckoutSession" (id, "packageId", "totalCents", currency, intent, "affiliateId", "affiliateCode", "affiliateRateBps", "affiliateSource", "topUpForOrderId", "topUpForIccid", "updatedAt") VALUES ($1,$2,1000,\'USD\',\'top-up\',$3,$4,1250,\'cookie\',$5,$6,NOW())', ["forged-topup-source", pkg.id, guide.id, guide.code, original.id, original.profiles[0].iccid]), /affiliate_checkout_snapshot_valid/);
    assert.equal(await accrueCommissionForOrder(wrongSim.order.id, database), null);
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: wrongSim.order.id } })).fulfilledAt, null);
    await reconcileAffiliateCommissions(database);
    assert.equal((await database.affiliateCommission.findUniqueOrThrow({ where: { checkoutId: valid.checkout.id } })).commissionCents, 125);
    assert.equal(await database.affiliateCommission.count({ where: { checkoutId: { in: [wrongSim.checkout.id, legacy.checkout.id] } } }), 0);
  });

  await t.test("new tables retain the backend-only RLS boundary", async () => {
    const rows = await sql.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname, relrowsecurity FROM pg_class WHERE relkind='r' AND relname LIKE 'Affiliate%'");
    assert.equal(rows.rows.length, 8); assert.ok(rows.rows.every(row => row.relrowsecurity));
    await sql.exec("SET ROLE anon");
    try { await assert.rejects(sql.query('SELECT * FROM "AffiliateProfile"'), /permission denied/); }
    finally { await sql.exec("RESET ROLE"); }
  });
});
