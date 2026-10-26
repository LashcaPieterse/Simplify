import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { finishOperation, refundBalance, runPaymentOperation, startPaymentOperation, type OperationInput } from "../lib/admin/financial";

test("real PostgreSQL: competing refund requests and final outcomes serialize", { timeout: 60_000 }, async t => {
  const url = new URL(process.env.TEST_POSTGRES_URL ?? "invalid:");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/simplify_remediation_test", "Use only the disposable localhost simplify_remediation_test database after test:postgres.");
  url.searchParams.set("connection_limit", "8");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const oldFlag = process.env.ADMIN_REFUNDS_ENABLED; process.env.ADMIN_REFUNDS_ENABLED = "true";
  t.after(async () => { await db.$disconnect(); if (oldFlag === undefined) delete process.env.ADMIN_REFUNDS_ENABLED; else process.env.ADMIN_REFUNDS_ENABLED = oldFlag; });
  const country = await db.country.upsert({ where: { countryCode: "NA" }, update: {}, create: { countryCode: "NA", slug: `admin-pg-${randomUUID()}`, title: "Fixture country" } });
  const operator = await db.operator.create({ data: { countryId: country.id, title: "Fixture operator", info: [] } });
  const pkg = await db.package.create({ data: { operatorId: operator.id, airaloPackageId: `admin-pg-${randomUUID()}`, type: "sim", title: "Fixture package", amount: 1024, data: "1 GB", day: 7, price: 10, manualInstallation: "", qrInstallation: "" } });
  const actor = "fixture-operator@example.test";
  async function sale() {
    const checkout = await db.checkoutSession.create({ data: { packageId: pkg.id, totalCents: 10000, currency: "NAD", status: "paid" } });
    const payment = await db.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", dpoMode: "live", transactionToken: `fixture-${randomUUID()}`, status: "approved", providerCode: "000", approvedAt: new Date(), amountCents: 10000, currency: "NAD" } });
    return { payment, checkout };
  }
  const request = (kind: OperationInput["kind"], targetId: string, version: Date, extra: Partial<OperationInput> = {}): OperationInput => ({ kind, targetId, expectedVersion: version.toISOString(), idempotencyKey: randomUUID(), reason: "Isolated PostgreSQL fixture evidence", confirmation: true, ...extra });

  await t.test("two operators cannot reserve more than the captured balance", async () => {
    const { payment } = await sale();
    const results = await Promise.allSettled([1, 2].map(() => startPaymentOperation(db, request("refund", payment.id, payment.updatedAt, { amount: "60" }), actor)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const balance = await db.$transaction(tx => refundBalance(tx, payment.id));
    assert.equal(balance.reserved, 6000); assert.equal(balance.remaining, 4000);
  });
  await t.test("unknown provider requests remain reserved without another submission", async () => {
    const { payment } = await sale(); let submitted = 0;
    const input = request("refund", payment.id, payment.updatedAt, { amount: "100" });
    const dpo = { verifyTransaction: async () => ({ status: "000", resultCode: "000", amount: 100, currency: "NAD", rawResponse: "fixture" }), mutateTransaction: async () => { submitted++; throw new Error("Fixture response lost after submission"); } };
    assert.equal((await runPaymentOperation(db, input, actor, { dpo })).outcome, "unknown");
    assert.equal((await runPaymentOperation(db, input, actor, { dpo })).outcome, "unknown");
    await assert.rejects(runPaymentOperation(db, { ...input, idempotencyKey: randomUUID() }, actor, { dpo }));
    assert.equal(submitted, 1); assert.equal((await db.$transaction(tx => refundBalance(tx, payment.id))).remaining, 0);
  });
  await t.test("a confirmed full refund blocks subsequent supplier claims", async () => {
    const { payment, checkout } = await sale();
    const order = await db.esimOrder.create({ data: { packageId: pkg.id, status: "pending", paymentTransactionId: payment.id } });
    await db.checkoutSession.update({ where: { id: checkout.id }, data: { orderId: order.id } });
    assert.equal((await runPaymentOperation(db, request("record_refund", payment.id, payment.updatedAt, { amount: "100", reference: `fixture-external-${randomUUID()}` }), actor)).outcome, "succeeded");
    await assert.rejects(db.esimOrder.update({ where: { id: order.id }, data: { status: "airalo_submitting" } }), /held or superseded/);
    assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status, "approved");
  });
  await t.test("competing terminal results preserve the first established outcome", async () => {
    const { payment } = await sale();
    const { operation } = await startPaymentOperation(db, request("verify_payment", payment.id, payment.updatedAt), actor);
    const outcomes = await Promise.all([finishOperation(db, operation, "succeeded", "verified", "fixture-confirmed"), finishOperation(db, operation, "rejected", "late_response", "fixture-rejected")]);
    assert.equal(outcomes[0].status, outcomes[1].status); assert.equal(outcomes[0].reference, outcomes[1].reference);
    const current = await db.adminOperation.findUniqueOrThrow({ where: { id: operation.id } });
    assert.equal(current.status, outcomes[0].status); assert.equal(current.reference, outcomes[0].reference);
  });
});
