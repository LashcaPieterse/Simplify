import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import { operationInputSchema, startPaymentOperation, runPaymentOperation, confirmRefund, rejectRefund, refundBalance, inspectPayment, finishOperation, reconcileAdminOperations, type OperationInput } from "./financial";
import { executeOperation } from "./operations";
import { orderDisposition } from "../orders/fulfillment-disposition";
import { finaliseOrderFromCheckout } from "../payments/checkouts";
import { paymentAttentionWhere, receiptAttentionWhere } from "./queries";
import type { AiraloClient } from "../airalo/client";
import { OrderResponseSchema } from "../airalo/schemas";
import { recoverAiraloOrders } from "../orders/recovery";
import { deliverReceipt } from "../notifications/receipt-outbox";
import { countFulfilledSales } from "./reporting";

test("admin operations: durable money movements, balance reservation, replacements and access restrictions", { timeout: 120_000 }, async t => {
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const previous = new Map(["ADMIN_CAPTURE_ENABLED", "ADMIN_REFUNDS_ENABLED", "ADMIN_REPLACEMENTS_ENABLED", "AIRALO_ASYNC_WEBHOOK_URL", "AIRALO_WEBHOOK_SECRET", "AFFILIATE_PROGRAM_ENABLED"].map(key => [key, process.env[key]]));
  process.env.ADMIN_CAPTURE_ENABLED = "true"; process.env.ADMIN_REFUNDS_ENABLED = "true"; process.env.ADMIN_REPLACEMENTS_ENABLED = "true";
  process.env.AIRALO_WEBHOOK_SECRET = "fixture-async-webhook-secret";
  process.env.AIRALO_ASYNC_WEBHOOK_URL = "https://fixture.example.test/api/airalo/webhooks"; process.env.AFFILIATE_PROGRAM_ENABLED = "false";
  let db: PrismaClient | undefined;
  t.after(async () => { if (db) await db.$disconnect(); await server.stop(); await sql.close(); for (const [key, value] of Array.from(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  await sql.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => /^\d/.test(name)).sort()) await sql.exec(readFileSync(new URL(`${name}/migration.sql`, directory), "utf8"));
  await server.start();
  const database = db = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30` } } });
  const country = await database.country.create({ data: { countryCode: "NA", slug: "ops-fixture", title: "Namibia" } });
  const operator = await database.operator.create({ data: { countryId: country.id, title: "Fixture network", info: [] } });
  const pkg = await database.package.create({ data: { operatorId: operator.id, airaloPackageId: "ops-fixture", type: "sim", title: "Fixture plan", amount: 1024, data: "1 GB", day: 7, price: 10, netPrice: 2, manualInstallation: "", qrInstallation: "", pricesRecommendedRetailPrice: { ZAR: 100 }, state: { create: { isActive: true, lastSyncedAt: new Date(), sellingPriceCents: 10000 } } } });
  const actor = "operator@example.test";
  async function sale(status = "approved", withOrder = false) {
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, customerEmail: "traveller@example.test", totalCents: 10000, currency: "NAD", status: status === "approved" ? "paid" : "pending" } });
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", providerReference: checkout.id, transactionToken: `fixture-${checkout.id}`, dpoMode: "live", status, providerCode: status === "approved" ? "000" : "001", amountCents: 10000, currency: "NAD", approvedAt: status === "approved" ? new Date() : null } });
    const order = withOrder ? await database.esimOrder.create({ data: { packageId: pkg.id, customerEmail: checkout.customerEmail, paymentTransactionId: payment.id, totalCents: 10000, currency: "NAD", status: "airalo_outcome_unknown" } }) : null;
    if (order) await database.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
    return { checkout, payment, order };
  }
  const input = (kind: OperationInput["kind"], id: string, version: Date, extra: Partial<OperationInput> = {}): OperationInput => ({ kind, targetId: id, expectedVersion: version.toISOString(), reason: "Verified operator evidence", idempotencyKey: randomUUID(), confirmation: true, ...extra });

  await t.test("capture acknowledgement stays pending until independent verification", async () => {
    const { payment } = await sale("authorized"); let mutations = 0;
    const request = input("capture", payment.id, payment.updatedAt);
    const result = await runPaymentOperation(database, request, actor, { dpo: { verifyTransaction: async () => ({ status: "001", resultCode: "001", amount: 100, currency: "NAD", rawResponse: "fixture" }), mutateTransaction: async () => { mutations++; return { code: "000", accepted: true, alreadyCharged: false }; } } });
    assert.equal(result.outcome, "provider_pending"); assert.equal((await database.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status, "authorized");
    assert.equal(await database.esimOrder.count({ where: { paymentTransactionId: payment.id } }), 0);
    await runPaymentOperation(database, request, actor, { dpo: { verifyTransaction: async () => { throw new Error("must not replay"); }, mutateTransaction: async () => { mutations++; throw new Error("must not replay"); } } });
    assert.equal(mutations, 1);
    await inspectPayment(database, payment.id, { dpo: { verifyTransaction: async () => ({ status: "000", resultCode: "000", amount: 100, currency: "NAD", rawResponse: "fixture" }), mutateTransaction: async () => { throw new Error("verification must not capture"); } } });
    assert.equal((await database.adminOperation.findUniqueOrThrow({ where: { id: result.operationId } })).status, "succeeded");
    const completed = await database.adminOperation.findUniqueOrThrow({ where: { id: result.operationId } });
    await finishOperation(database, completed, "rejected", "late_provider_response", "unrelated-reference");
    const preserved = await database.adminOperation.findUniqueOrThrow({ where: { id: result.operationId } });
    assert.equal(preserved.status, "succeeded"); assert.equal(preserved.reference, completed.reference);
  });
  await t.test("concurrent refunds reserve at most the available captured balance", async () => {
    const { payment } = await sale();
    const attempts = await Promise.allSettled([1, 2].map(() => startPaymentOperation(database, input("refund", payment.id, payment.updatedAt, { amount: "60.00" }), actor)));
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await database.paymentRefund.aggregate({ where: { paymentId: payment.id }, _sum: { amountCents: true } }))._sum.amountCents, 6000);
  });
  await t.test("lost refund responses stay reserved and cannot be retried with a new key", async () => {
    const { payment, checkout } = await sale(); let submissions = 0;
    const request = input("refund", payment.id, payment.updatedAt, { amount: "100.00" });
    const dependencies = { dpo: { verifyTransaction: async () => ({ status: "000", amount: 100, currency: "NAD", rawResponse: "fixture" }), mutateTransaction: async () => { submissions++; throw new Error("response lost after provider acceptance"); } } };
    assert.equal((await runPaymentOperation(database, request, actor, dependencies)).outcome, "unknown");
    await runPaymentOperation(database, request, actor, dependencies); assert.equal(submissions, 1);
    await assert.rejects(runPaymentOperation(database, { ...request, idempotencyKey: randomUUID() }, actor, dependencies), /reconciliation/);
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).fulfillmentHold, "refund_pending");
    const refund = await database.paymentRefund.findFirstOrThrow({ where: { paymentId: payment.id } });
    await confirmRefund(database, refund.id, actor, "Provider statement confirmed refund");
    await assert.rejects(rejectRefund(database, refund.id), /confirmed refund/);
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).fulfillmentHold, "refunded");
    assert.equal((await database.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status, "approved");
    await assert.rejects(finaliseOrderFromCheckout(checkout.id, { prisma: database }), /held|replacement/i);
  });
  await t.test("provider amount mismatch prevents capture and stale records are rejected", async () => {
    const { payment } = await sale("authorized"); let called = false;
    await assert.rejects(runPaymentOperation(database, input("capture", payment.id, payment.updatedAt), actor, { dpo: { verifyTransaction: async () => ({ status: "001", amount: 90, currency: "NAD", rawResponse: "fixture" }), mutateTransaction: async () => { called = true; throw new Error("must not capture"); } } }), /amount or currency/);
    assert.equal(called, false);
    await assert.rejects(startPaymentOperation(database, input("capture", payment.id, new Date(0)), actor), /changed/);
  });
  await t.test("a full external refund and supplier claims serialize on the original sale", async () => {
    const { payment, order } = await sale("approved", true);
    const result = await runPaymentOperation(database, input("record_refund", payment.id, payment.updatedAt, { amount: "100", reference: `external-${randomUUID()}` }), actor);
    assert.equal(result.outcome, "succeeded");
    await database.esimOrder.update({ where: { id: order!.id }, data: { status: "pending" } });
    await assert.rejects(database.esimOrder.update({ where: { id: order!.id }, data: { status: "airalo_submitting" } }), /held or superseded/);
    await database.$disconnect();
    assert.equal((await database.$transaction(tx => refundBalance(tx, payment.id))).remaining, 0);
  });
  await t.test("partial and full confirmed refunds preserve approval and adjust affiliate earnings once", async () => {
    const user = await database.user.create({ data: { email: "fixture-guide@example.test" } });
    const guide = await database.affiliateProfile.create({ data: { userId: user.id, code: "OPSGUIDE12", legalName: "Fixture", publicName: "Fixture guide", country: "NA", contactEmail: user.email!, phone: "fixture", promotion: "fixture", termsVersion: "fixture" } });
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, totalCents: 10000, currency: "NAD", status: "paid", affiliateId: guide.id, affiliateCode: guide.code, affiliateRateBps: 1000, affiliateSource: "code" } });
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", dpoMode: "live", status: "approved", providerCode: "000", amountCents: 10000, currency: "NAD", approvedAt: new Date() } });
    const order = await database.esimOrder.create({ data: { packageId: pkg.id, paymentTransactionId: payment.id, status: "completed", orderNumber: "fulfilled-refund-fixture", fulfilledAt: new Date() } });
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
    const fulfilledAt = new Date(); const availableAt = new Date(fulfilledAt.getTime() + 30 * 86400000);
    const commission = await database.affiliateCommission.create({ data: { checkoutId: checkout.id, orderId: order.id, affiliateId: guide.id, currency: "NAD", saleCents: 10000, rateBps: 1000, commissionCents: 1000, fulfilledAt, availableAt } });
    await database.affiliateLedgerEntry.create({ data: { affiliateId: guide.id, commissionId: commission.id, kind: "commission", amountCents: 1000, currency: "NAD", availableAt: new Date(), idempotencyKey: `commission:${checkout.id}` } });
    const partial = await runPaymentOperation(database, input("record_refund", payment.id, payment.updatedAt, { amount: "40", reference: "fixture-partial-refund" }), actor);
    assert.equal(partial.outcome, "succeeded");
    const refund = await database.paymentRefund.findUniqueOrThrow({ where: { operationId: partial.operationId } });
    await confirmRefund(database, refund.id, actor, "Repeated verification must preserve original evidence");
    assert.equal((await database.paymentRefund.findUniqueOrThrow({ where: { id: refund.id } })).evidence, refund.evidence);
    assert.equal((await database.$transaction(tx => refundBalance(tx, payment.id))).remaining, 6000);
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).fulfillmentHold, null);
    const full = await runPaymentOperation(database, input("record_refund", payment.id, payment.updatedAt, { amount: "60", reference: "fixture-final-refund" }), actor);
    assert.equal(full.outcome, "succeeded");
    assert.equal(await database.affiliateSaleAdjustment.count({ where: { checkoutId: checkout.id } }), 2);
    assert.equal((await database.affiliateLedgerEntry.aggregate({ where: { commissionId: commission.id, kind: "refund" }, _sum: { amountCents: true } }))._sum.amountCents, -1000);
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).fulfillmentHold, "refunded");
    assert.equal((await database.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status, "approved");
  });
  await t.test("goodwill replacements preserve original evidence, suppress old delivery and submit once", async () => {
    const { payment, order, checkout } = await sale("approved", true); let submissions = 0;
    await database.receiptDelivery.create({ data: { orderId: order!.id, businessKey: `receipt:${order!.id}:v1`, status: "review" } });
    const airalo = { createOrderAsync: async () => { submissions++; return { request_id: "fixture-request", accepted_at: new Date().toISOString() }; }, createOrderAsyncResponse: async () => { submissions++; return { data: { request_id: "fixture-request", accepted_at: new Date().toISOString() } }; } } as unknown as AiraloClient;
    const request = input("replace_order", order!.id, order!.updatedAt, { duplicateCostAccepted: true, previewVersion: createHash("sha256").update(`${pkg.id}:${pkg.updatedAt.toISOString()}:${pkg.netPrice ?? pkg.price}`).digest("hex") });
    const result = await executeOperation(database, request, actor, { airalo });
    assert.equal(result.outcome, "provider_pending"); assert.equal(submissions, 1);
    await executeOperation(database, request, actor, { airalo }); assert.equal(submissions, 1);
    const original = await database.esimOrder.findUniqueOrThrow({ where: { id: order!.id } }); assert.equal(original.status, "airalo_outcome_unknown");
    const current = await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } }); assert.equal(current.orderId, order!.id); assert.notEqual(current.activeOrderId, order!.id);
    assert.equal((await orderDisposition(database, order!.id)).blocked, true);
    assert.equal((await database.receiptDelivery.findFirstOrThrow({ where: { orderId: order!.id } })).status, "superseded");
    const replacement = await database.esimOrder.findUniqueOrThrow({ where: { id: current.activeOrderId! } }); assert.equal(replacement.totalCents, 0); assert.equal(replacement.paymentTransactionId, payment.id);
    const purchase = OrderResponseSchema.parse({ data: { id: "fixture-supplier", status: "completed", package_id: pkg.airaloPackageId, quantity: 1, description: `[simplify_order_id:${replacement.id}]`, sims: [{ iccid: `fixture-sim-${replacement.id}`, matching_id: "fixture-activation" }] } }).data;
    const recovery = await recoverAiraloOrders({ prisma: database, orderId: replacement.id, limit: 1, airalo: { getOrderById: async () => purchase, findOrdersByDescription: async () => [purchase] } });
    assert.equal(recovery.recovered, 1);
    const savedOperation = await database.adminOperation.findUniqueOrThrow({ where: { id: result.operationId } });
    const resolution = await executeOperation(database, input("resolve_operation", savedOperation.id, savedOperation.updatedAt, { reference: "provider-case-verified", outcome: "confirmed" }), actor);
    assert.equal(resolution.outcome, "succeeded");
    assert.equal((await database.adminOperation.findUniqueOrThrow({ where: { id: savedOperation.id } })).reference, replacement.id);
    await assert.rejects(database.esimOrder.update({ where: { id: order!.id }, data: { status: "airalo_submitting" } }), /held or superseded/);
    await database.$disconnect();
  });
  await t.test("shared attention rules select the exact payment and receipt queues", async () => {
    const { payment, order } = await sale("authorized", true);
    await database.paymentTransaction.update({ where: { id: payment.id }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    const rows = await database.paymentTransaction.findMany({ where: paymentAttentionWhere() }); assert.ok(rows.some(row => row.id === payment.id));
    const receipt = await database.receiptDelivery.create({ data: { orderId: order!.id, businessKey: `receipt:${order!.id}:v1`, status: "review" } });
    assert.ok((await database.receiptDelivery.findMany({ where: receiptAttentionWhere() })).some(row => row.id === receipt.id));
    await database.checkoutSession.update({ where: { id: (await database.esimOrder.findUniqueOrThrow({ where: { id: order!.id }, include: { checkout: true } })).checkout!.id }, data: { fulfillmentHold: "refunded" } });
    assert.ok(!(await database.receiptDelivery.findMany({ where: receiptAttentionWhere() })).some(row => row.id === receipt.id));
    assert.equal(await deliverReceipt(database, receipt.id, { send: async () => { throw new Error("must not send"); } }), "busy");
  });
  await t.test("unresolved recovery stays pending and expired financial executions are never replayed", async () => {
    const { payment, order } = await sale("approved", true);
    const airalo = { findOrdersByDescription: async () => [], getOrderById: async () => null } as unknown as AiraloClient;
    const result = await executeOperation(database, input("recover_order", order!.id, order!.updatedAt), actor, { airalo });
    assert.equal(result.outcome, "pending");
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: order!.id } })).status, "airalo_outcome_unknown");
    const started = await startPaymentOperation(database, input("refund", payment.id, payment.updatedAt, { amount: "50" }), actor);
    await database.adminOperation.update({ where: { id: started.operation.id }, data: { leaseUntil: new Date(0) } });
    await reconcileAdminOperations(database);
    const operation = await database.adminOperation.findUniqueOrThrow({ where: { id: started.operation.id } });
    assert.equal(operation.status, "unknown"); assert.equal(operation.resultCode, "execution_lease_expired");
    assert.equal((await database.$transaction(tx => refundBalance(tx, payment.id))).remaining, 5000);
    await assert.rejects(startPaymentOperation(database, input("refund", payment.id, payment.updatedAt, { amount: "50" }), actor), /reconciliation/);
  });
  await t.test("top-up replacements retain the original owner and ICCID and check current eligibility", async () => {
    const topUp = await database.package.create({ data: { operatorId: operator.id, airaloPackageId: "ops-topup-fixture", type: "topup", title: "Fixture top-up", amount: 1024, data: "1 GB", day: 7, price: 10, netPrice: 2, manualInstallation: "", qrInstallation: "", pricesRecommendedRetailPrice: { ZAR: 100 }, state: { create: { isActive: true, lastSyncedAt: new Date(), sellingPriceCents: 10000 } } } });
    const owner = await database.user.create({ data: { email: "fixture-sim-owner@example.test" } });
    const original = await database.esimOrder.create({ data: { packageId: pkg.id, userId: owner.id, status: "completed", orderNumber: "fixture-original-sim" } });
    const profile = await database.esimProfile.create({ data: { orderId: original.id, iccid: "8900000000000000012", status: "active", activationCode: "fixture-activation" } });
    const { checkout, payment, order } = await sale("approved", true);
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { userId: owner.id, packageId: topUp.id, intent: "top-up", topUpForOrderId: original.id, topUpForIccid: profile.iccid } });
    const updated = await database.esimOrder.update({ where: { id: order!.id }, data: { userId: owner.id, packageId: topUp.id } });
    let checks = 0; let purchases = 0;
    const airalo = {
      getSimTopUpPackages: async (iccid: string) => { assert.equal(iccid, profile.iccid); checks++; return [{ id: topUp.airaloPackageId }]; },
      createTopUpOrderResponse: async (payload: { iccid: string; description?: string }) => { assert.equal(payload.iccid, profile.iccid); purchases++; return OrderResponseSchema.parse({ data: { id: "fixture-replacement-topup", status: "completed", package_id: topUp.airaloPackageId, description: payload.description, iccid: profile.iccid } }); },
    } as unknown as AiraloClient;
    const result = await executeOperation(database, input("replace_order", updated.id, updated.updatedAt, { duplicateCostAccepted: true, previewVersion: createHash("sha256").update(`${topUp.id}:${topUp.updatedAt.toISOString()}:${topUp.netPrice}`).digest("hex") }), actor, { airalo });
    assert.equal(result.outcome, "provider_pending"); assert.equal(checks, 1); assert.equal(purchases, 1);
    const current = await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } });
    const replacement = await database.esimOrder.findUniqueOrThrow({ where: { id: current.activeOrderId! } });
    assert.equal(replacement.userId, owner.id); assert.equal(replacement.paymentTransactionId, payment.id); assert.equal(replacement.totalCents, 0);
    assert.equal(current.topUpForIccid, profile.iccid); assert.equal(current.topUpForOrderId, original.id);
    assert.equal((await database.esimProfile.findUniqueOrThrow({ where: { id: profile.id } })).orderId, original.id);
    assert.equal(await database.esimProfile.count({ where: { orderId: replacement.id } }), 0);
    assert.equal(await database.receiptDelivery.count({ where: { orderId: replacement.id } }), 0);
  });
  await t.test("reporting includes non-affiliate sales and counts only the verified active delivery", async () => {
    const { payment, checkout, order } = await sale("approved", true);
    await database.paymentTransaction.update({ where: { id: payment.id }, data: { dpoMode: "test" } });
    await database.esimOrder.update({ where: { id: order!.id }, data: { status: "completed", orderNumber: "fixture-reporting-original", profiles: { create: { iccid: "8900000000000000023", status: "active", activationCode: "fixture-personal-activation" } } } });
    const query = { from: new Date(Date.now() - 60_000), currency: "NAD", mode: "test" as const };
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: order!.id } })).fulfilledAt, null);
    assert.equal(await countFulfilledSales(database, query), 1);
    const replacement = await database.esimOrder.create({ data: { packageId: pkg.id, status: "pending", replacementForId: order!.id, saleCheckoutId: checkout.id, paymentTransactionId: payment.id } });
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { activeOrderId: replacement.id } });
    assert.equal(await countFulfilledSales(database, query), 0);
    await database.esimOrder.update({ where: { id: replacement.id }, data: { status: "completed", orderNumber: "fixture-reporting-replacement", profiles: { create: { iccid: "8900000000000000024", status: "active", activationCode: "fixture-replacement-activation" } } } });
    assert.equal(await countFulfilledSales(database, query), 1);
    await database.checkoutSession.update({ where: { id: checkout.id }, data: { fulfillmentHold: "refunded" } });
    assert.equal(await countFulfilledSales(database, query), 1);
    assert.equal(await countFulfilledSales(database, { ...query, currency: "USD" }), 0);
  });
  await t.test("input validation rejects missing confirmation and backend tables deny client roles", async () => {
    assert.equal(operationInputSchema.safeParse({ kind: "capture", targetId: "x" }).success, false);
    await assert.rejects(database.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL ROLE anon"); await tx.$queryRaw`SELECT id FROM public."AdminOperation"`; }), /permission denied/);
  });
});

test("admin migration adopts existing external refunds without replaying money movement", { timeout: 60_000 }, async t => {
  const sql = await PGlite.create(); t.after(() => sql.close());
  await sql.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => /^\d/.test(name) && name !== "20261026190000_admin_operations").sort()) await sql.exec(readFileSync(new URL(`${name}/migration.sql`, directory), "utf8"));
  await sql.exec(`
    INSERT INTO countries (id,country_code,slug,title) VALUES ('00000000-0000-0000-0000-000000000001','NA','legacy-ops','Fixture');
    INSERT INTO operators (id,country_id,title) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Fixture');
    INSERT INTO packages (id,operator_id,airalo_package_id,type,title,amount,data,day,manual_installation,qr_installation,price)
    VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','legacy-ops','sim','Fixture',1024,'1 GB',7,'','',10);
    INSERT INTO "CheckoutSession" (id,"packageId","totalCents",currency,status,"updatedAt") VALUES ('legacy-sale','00000000-0000-0000-0000-000000000003',1000,'NAD','paid',CURRENT_TIMESTAMP);
    INSERT INTO "PaymentTransaction" (id,provider,"dpoMode",status,"amountCents",currency,"checkoutId","updatedAt") VALUES ('legacy-payment','dpo','live','approved',1000,'NAD','legacy-sale',CURRENT_TIMESTAMP);
    INSERT INTO "AffiliateSaleAdjustment" (id,"checkoutId","saleRefundCents",reference,reason,"actorEmail","idempotencyKey") VALUES ('legacy-adjustment','legacy-sale',1000,'bank-evidence-1','Recorded external refund','operator@example.test','legacy-refund-key');
  `);
  await sql.exec(readFileSync(new URL("20261026190000_admin_operations/migration.sql", directory), "utf8"));
  assert.deepEqual((await sql.query(`SELECT "amountCents",currency,status,reference FROM "PaymentRefund"`)).rows, [{ amountCents: 1000, currency: "NAD", status: "confirmed", reference: "bank-evidence-1" }]);
  assert.deepEqual((await sql.query(`SELECT status FROM "PaymentTransaction"`)).rows, [{ status: "approved" }]);
  assert.deepEqual((await sql.query(`SELECT "fulfillmentHold" FROM "CheckoutSession"`)).rows, [{ fulfillmentHold: "refunded" }]);
  assert.deepEqual((await sql.query(`SELECT status,"resultCode" FROM "AdminOperation"`)).rows, [{ status: "succeeded", resultCode: "legacy_external_refund" }]);
});
