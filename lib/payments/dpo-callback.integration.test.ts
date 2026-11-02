import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import type { AiraloClient } from "../airalo/client";
import { OrderResponseSchema, SimResponseSchema } from "../airalo/schemas";
import { processPaymentCallback, queuePaymentVerification } from "../jobs/lifecycle";
import { claimJob, enqueueJob } from "../jobs/store";
import { handleDpoPushRoute } from "./dpo-push-route";
import { DPO_PUSH_OK_XML } from "./dpo-ipn";

test("DPO callbacks: durable acknowledgement, immediate verification and leased fulfilment", { timeout: 120_000 }, async t => {
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const overrides = {
    PURCHASE_LIFECYCLE_ENABLED: "true", RECEIPT_OUTBOX_ENABLED: "true",
    AFFILIATE_PROGRAM_ENABLED: "false", RATE_LIMIT_SECRET: "callback-fixture-rate-secret",
    ORDER_ACCESS_SECRET: "callback-fixture-access-secret",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, overrides);
  globalThis.fetch = async () => { throw new Error("Unexpected external request in isolated callback fixture"); };
  let database: PrismaClient | undefined;
  t.after(async () => {
    if (database) await database.$disconnect();
    await server.stop(); await sql.close();
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  });
  await sql.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  const migrations = new URL("../../prisma/migrations/", import.meta.url);
  for (const name of readdirSync(migrations).filter(name => /^\d/.test(name)).sort()) {
    await sql.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
  }
  await server.start();
  const db = database = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30` } } });
  const country = await db.country.create({ data: { countryCode: "NA", slug: "callback-fixture", title: "Fixture" } });
  const operator = await db.operator.create({ data: { countryId: country.id, title: "Fixture", info: [] } });
  const pkg = await db.package.create({ data: { operatorId: operator.id, airaloPackageId: "callback-fixture", type: "sim", title: "Fixture plan", amount: 1024, data: "1 GB", day: 7, price: 10, manualInstallation: "", qrInstallation: "" } });

  async function fixture(code = "000", amount = 10, unavailable = false) {
    const checkout = await db.checkoutSession.create({ data: { packageId: pkg.id, customerEmail: "callback@example.test", totalCents: 1000, currency: "NAD" } });
    const payment = await db.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", dpoMode: "live", transactionToken: `fixture-${checkout.id}`, amountCents: 1000, currency: "NAD" } });
    const job = await enqueueJob(db, "verify_payment", payment.id);
    await db.lifecycleJob.update({ where: { id: job.id }, data: { attempts: 1, updatedAt: new Date(Date.now() - 60_000), nextAttemptAt: new Date(Date.now() + 300_000), lastError: "incomplete" } });
    const counts = { verifications: 0, purchases: 0, receipts: 0 };
    const order = OrderResponseSchema.parse({ status: true, data: { order_id: `supplier-${checkout.id}`, status: "completed", iccid: `iccid-${checkout.id}`, activation_code: "LPA:1$rsp.example.test$fixture" } });
    const airalo = {
      createOrderResponse: async () => { counts.purchases++; return order; },
      getOrderResponseById: async () => order,
      getSimResponse: async () => SimResponseSchema.parse({ status: true, data: { id: 1, created_at: "2026-11-02T00:00:00Z", iccid: order.data.iccid, lpa: "rsp.example.test", matching_id: "fixture", status: "completed" } }),
    } as unknown as AiraloClient;
    const options = {
      dpoClient: { verifyTransaction: async () => {
        counts.verifications++;
        if (unavailable) throw new Error("Fixture provider unavailable");
        return { status: code, resultCode: code, amount, currency: "NAD", rawResponse: { Result: code } };
      } },
      airaloOptions: { airaloClient: airalo, submissionMode: "sync" as const },
      receiptOptions: { baseUrl: "https://callback.example.test", send: async () => {
        counts.receipts++; return { id: `receipt-${checkout.id}`, skipped: false };
      } },
    };
    const work: Array<() => Promise<void>> = [];
    const push = () => handleDpoPushRoute(new Request("https://callback.example.test/api/payments/dpo/push", {
      method: "POST", headers: { "content-type": "application/xml" },
      // A claimed paid notification must never override the independent provider result.
      body: `<API3G><Result>000</Result><TransactionToken>${payment.transactionToken}</TransactionToken><TransactionAmount>10.00</TransactionAmount><TransactionCurrency>NAD</TransactionCurrency></API3G>`,
    }), { prisma: db, afterResponse: task => { work.push(task); }, processCallback: (id, client) => processPaymentCallback(id, client, options) });
    return { checkout, payment, job, counts, options, work, push };
  }

  await t.test("a paid push wakes a five-minute retry before ACK and completes without cron", async () => {
    const f = await fixture();
    const response = await f.push();
    assert.equal(response.status, 200);
    assert.equal(await response.text(), DPO_PUSH_OK_XML);
    assert.equal(f.counts.verifications, 0, "Provider work must start after acknowledgement.");
    const queued = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.ok(queued.nextAttemptAt.getTime() <= Date.now());
    assert.equal(await db.paymentTransactionEvent.count({ where: { transactionId: f.payment.id, eventType: "dpo-push" } }), 1);
    await f.work[0]();
    const checkout = await db.checkoutSession.findUniqueOrThrow({ where: { id: f.checkout.id }, include: { order: { include: { profiles: true } } } });
    assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: f.payment.id } })).status, "approved");
    assert.equal(checkout.order?.status, "completed");
    assert.equal(checkout.order.profiles.length, 1);
    assert.ok(checkout.order.receiptSentAt);
    assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `complete_installation:${checkout.orderId}` } })).status, "done");
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

  await t.test("concurrent and replayed callbacks share verification, purchase and receipt claims", async () => {
    const f = await fixture();
    const responses = await Promise.all([f.push(), f.push()]);
    assert.ok(responses.every(response => response.status === 200));
    await Promise.all(f.work.map(task => task()));
    await Promise.all([processPaymentCallback(f.payment.id, db, f.options), processPaymentCallback(f.payment.id, db, f.options)]);
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
    assert.equal(await db.esimOrder.count({ where: { paymentTransactionId: f.payment.id } }), 1);
    assert.equal(await db.receiptDelivery.count({ where: { order: { paymentTransactionId: f.payment.id } } }), 1);
  });

  await t.test("the short verification cooldown finishes after ACK without waiting for cron", async () => {
    const f = await fixture();
    await db.lifecycleJob.update({ where: { id: f.job.id }, data: { updatedAt: new Date(Date.now() - 14_000) } });
    assert.equal((await f.push()).status, 200);
    const first = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.ok(first.nextAttemptAt.getTime() > Date.now());
    await queuePaymentVerification(f.payment.id, db, true);
    const second = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.equal(second.nextAttemptAt.getTime(), first.nextAttemptAt.getTime(), "Replays must not extend the cooldown.");
    await f.work[0]();
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

  await t.test("authorization, amount mismatch and provider failure never authorize fulfilment", async () => {
    for (const [code, amount, unavailable, expected] of [
      ["001", 10, false, "authorized"], ["000", 11, false, "verification_mismatch"], ["000", 10, true, "pending"],
    ] as const) {
      const f = await fixture(code, amount, unavailable);
      assert.equal((await f.push()).status, 200);
      await f.work[0]();
      assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: f.payment.id } })).status, expected);
      assert.equal(f.counts.purchases, 0); assert.equal(f.counts.receipts, 0);
      const job = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
      assert.equal(job.status, expected === "verification_mismatch" ? "review" : "pending");
      assert.ok(job.nextAttemptAt.getTime() > Date.now());
    }
  });

  await t.test("a callback cannot steal an active worker's lease", async () => {
    const f = await fixture();
    await db.lifecycleJob.update({ where: { id: f.job.id }, data: { nextAttemptAt: new Date(0) } });
    const lease = await claimJob(db, f.job.id);
    assert.ok(lease);
    assert.equal((await f.push()).status, 200);
    await f.work[0]();
    assert.deepEqual(await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } }), lease);
    assert.deepEqual(f.counts, { verifications: 0, purchases: 0, receipts: 0 });
  });

  await t.test("disabled processing leaves durable callback work for recovery", async () => {
    const f = await fixture();
    process.env.PURCHASE_LIFECYCLE_ENABLED = "false";
    try {
      assert.equal((await f.push()).status, 200);
      await f.work[0]();
      assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } })).status, "pending");
      assert.equal(f.counts.verifications, 0);
    } finally { process.env.PURCHASE_LIFECYCLE_ENABLED = "true"; }
    await processPaymentCallback(f.payment.id, db, f.options);
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

  await t.test("an uncertain existing supplier order is held instead of purchased again", async () => {
    const f = await fixture();
    const order = await db.esimOrder.create({ data: { packageId: pkg.id, paymentTransactionId: f.payment.id, status: "airalo_outcome_unknown" } });
    await db.checkoutSession.update({ where: { id: f.checkout.id }, data: { orderId: order.id } });
    assert.equal((await f.push()).status, 200);
    await f.work[0]();
    assert.equal(f.counts.purchases, 0); assert.equal(f.counts.receipts, 0);
    const job = await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `fulfill_checkout:${f.checkout.id}` } });
    assert.equal(job.status, "review");
    assert.equal(job.lastError, "supplier_outcome_unknown");
  });

  await t.test("failure to persist the verification wakeup is not acknowledged as success", async () => {
    const f = await fixture();
    await sql.exec(`CREATE FUNCTION reject_callback_wakeup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture queue unavailable'; END; $$;
      CREATE TRIGGER reject_callback_wakeup BEFORE UPDATE ON "LifecycleJob" FOR EACH ROW EXECUTE FUNCTION reject_callback_wakeup();`);
    try {
      const response = await f.push();
      assert.equal(response.status, 503);
      assert.equal(f.work.length, 0);
      assert.equal(f.counts.verifications, 0);
    } finally { await sql.exec('DROP TRIGGER reject_callback_wakeup ON "LifecycleJob"; DROP FUNCTION reject_callback_wakeup();'); }
  });
});
