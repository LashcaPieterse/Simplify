import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import type { AiraloClient } from "../airalo/client";
import { OrderResponseSchema, SimResponseSchema, SubmitOrderAsyncResponseSchema } from "../airalo/schemas";
import { processPaymentCallback, queuePaymentVerification, requestPaymentProcessing, processPaymentWorkflow, requestOrderProcessing, processOrderDelivery } from "../jobs/lifecycle";
import { claimJob, enqueueJob, finishJob, jobEligibleAt } from "../jobs/store";
import { handleCheckoutReconcileRoute } from "./checkout-reconcile-route";
import { checkoutStatusResponse } from "./checkout-status";
import { handleAiraloWebhookRoute } from "../orders/airalo-webhook-route";
import { deliverReceipt, queueOrderReceipt, wakeOrderReceipt } from "../notifications/receipt-outbox";
import { withProcessingContext, providerSignal, processingWait } from "../jobs/execution";
import { handleDpoPushRoute } from "./dpo-push-route";
import { DPO_PUSH_OK_XML } from "./dpo-push";

test("DPO callbacks: durable acknowledgement, immediate verification and leased fulfilment", { timeout: 120_000 }, async t => {
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const overrides = {
    PURCHASE_LIFECYCLE_ENABLED: "true", RECEIPT_OUTBOX_ENABLED: "true",
    AFFILIATE_PROGRAM_ENABLED: "false", RATE_LIMIT_SECRET: "callback-fixture-rate-secret",
    ORDER_ACCESS_SECRET: "callback-fixture-access-secret", AIRALO_WEBHOOK_SECRET: "supplier-fixture-secret",
    NEXT_PUBLIC_APP_URL: "https://callback.example.test",
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
      dpoClient: { verifyTransaction: async (_token: string, _reference?: string, request?: { markProcessed?: boolean }) => {
        if (request?.markProcessed) return { status: "000", resultCode: "000", rawResponse: { Result: "000" } };
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
    const push = (query = "") => handleDpoPushRoute(new Request(`https://callback.example.test/api/payments/dpo/push${query}`, {
      method: "POST", headers: { "content-type": "application/xml" },
      // A claimed paid notification must never override the independent provider result.
      body: `<API3G><Result>000</Result><TransactionToken>${payment.transactionToken}</TransactionToken><TransactionAmount>10.00</TransactionAmount><TransactionCurrency>NAD</TransactionCurrency></API3G>`,
    }), { prisma: db, afterResponse: task => { work.push(task); }, processCallback: (id, client) => processPaymentCallback(id, client, options) });
    return { checkout, payment, job, counts, options, work, push, airalo, supplierOrder: order };
  }

  await t.test("a paid push wakes a five-minute retry before ACK and completes without cron", async () => {
    const f = await fixture();
    const response = await f.push();
    assert.equal(response.status, 200);
    assert.equal(await response.text(), DPO_PUSH_OK_XML);
    assert.equal(f.counts.verifications, 0, "Provider work must start after acknowledgement.");
    const queued = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.ok(queued.nextAttemptAt.getTime() <= Date.now());
    const event = await db.paymentTransactionEvent.findFirstOrThrow({ where: { transactionId: f.payment.id, eventType: "dpo-push" } });
    const payload = JSON.parse(event.payload);
    assert.equal(payload.Result, "000");
    assert.equal(payload.TransactionToken, f.payment.transactionToken);
    assert.deepEqual(payload.request, {
      correlationId: response.headers.get("x-correlation-id"),
      pathname: "/api/payments/dpo/push", method: "POST", receivedAt: payload.request.receivedAt,
    });
    assert.ok(Number.isFinite(Date.parse(payload.request.receivedAt)));
    const diagnostic = await db.paymentCallbackDiagnostic.findUniqueOrThrow({ where: { correlationId: payload.request.correlationId } });
    assert.equal(diagnostic.status, 200);
    assert.equal(diagnostic.result, "matched_notification");
    await f.work[0]();
    const checkout = await db.checkoutSession.findUniqueOrThrow({ where: { id: f.checkout.id }, include: { order: { include: { profiles: true } } } });
    assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: f.payment.id } })).status, "approved");
    assert.equal(checkout.order?.status, "completed");
    assert.equal(checkout.order.profiles.length, 1);
    assert.ok(checkout.order.receiptSentAt);
    assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `complete_installation:${checkout.orderId}` } })).status, "done");
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

  await t.test("request tracing excludes URL queries and links rejected requests without queuing payment work", async () => {
    const f = await fixture();
    const logs: unknown[][] = [];
    const originalInfo = console.info;
    console.info = (...args: unknown[]) => { logs.push(args); };
    try {
      const response = await f.push("?sensitive=test-query-value");
      const event = await db.paymentTransactionEvent.findFirstOrThrow({ where: { transactionId: f.payment.id, eventType: "dpo-push" } });
      assert.ok(!event.payload.includes("test-query-value"));
      assert.equal(JSON.parse(event.payload).request.pathname, "/api/payments/dpo/push");
      assert.ok(!JSON.stringify(logs).includes("test-query-value"));
      assert.ok(!JSON.stringify(logs).includes(f.payment.transactionToken!));
      assert.ok(logs.some(args => args[0] === "payments.dpo.push.response" &&
        (args[1] as { correlationId: string; status: number }).correlationId === response.headers.get("x-correlation-id") &&
        (args[1] as { status: number }).status === 200));

      const eventsBefore = await db.paymentTransactionEvent.count();
      const jobsBefore = await db.lifecycleJob.count();
      const rejected = await handleDpoPushRoute(new Request("https://callback.example.test/api/payments/dpo/push?secret=test-rejected-query", {
        method: "POST", headers: { "content-type": "application/xml", "x-correlation-id": "untrusted-incoming-id" },
        body: "<API3G><Result>000</Result><TransactionToken>unknown-test-token</TransactionToken></API3G>",
      }), { prisma: db, afterResponse: () => { assert.fail("An unmatched push must not queue payment work."); } });
      assert.equal(rejected.status, 404);
      assert.notEqual(rejected.headers.get("x-correlation-id"), "untrusted-incoming-id");
      const diagnostic = await db.paymentCallbackDiagnostic.findUniqueOrThrow({ where: { correlationId: rejected.headers.get("x-correlation-id")! } });
      assert.equal(diagnostic.status, 404);
      assert.equal(await db.paymentTransactionEvent.count(), eventsBefore);
      assert.equal(await db.lifecycleJob.count(), jobsBefore);
      assert.ok(logs.some(args => args[0] === "payments.dpo.push.received" &&
        (args[1] as { correlationId: string }).correlationId === diagnostic.correlationId));
      assert.ok(!JSON.stringify(logs).includes("test-rejected-query"));
      assert.ok(!JSON.stringify(logs).includes("unknown-test-token"));
    } finally { console.info = originalInfo; }
  });

  await t.test("an oversized callback retains a response correlation ID and rejection diagnostic", async () => {
    const response = await handleDpoPushRoute(new Request("https://callback.example.test/api/payments/dpo/push", {
      method: "POST", body: "x".repeat(256 * 1024 + 1),
    }), { prisma: db, afterResponse: () => { assert.fail("An oversized push must not queue payment work."); } });
    assert.equal(response.status, 413);
    const diagnostic = await db.paymentCallbackDiagnostic.findUniqueOrThrow({ where: { correlationId: response.headers.get("x-correlation-id")! } });
    assert.equal(diagnostic.status, 413);
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
    const queued = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.equal(queued.status, "leased");
    assert.equal(queued.leaseToken, lease.leaseToken);
    assert.equal(queued.leaseUntil?.getTime(), lease.leaseUntil?.getTime());
    assert.equal(queued.attempts, lease.attempts);
    assert.equal(queued.wakeVersion, lease.wakeVersion + 1, "New information must survive the active lease.");
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

  await t.test("browser return advances a five-minute retry and completes without any callback or cron", async () => {
    const f = await fixture();
    const work: Array<() => Promise<void>> = [];
    const authorize = async (_request: Request, id: string) => db.checkoutSession.findUnique({ where: { id }, include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 }, activeOrder: { include: { installation: true, profiles: true } }, order: { include: { installation: true, profiles: true } },
    } });
    const options = { prisma: db, authorize, afterResponse: (task: () => Promise<void>) => { work.push(task); },
      process: (id: string, client = db) => processPaymentWorkflow(id, client, { ...f.options, trigger: "browser" as const }) };
    const request = () => new Request("https://callback.example.test/api/checkouts/fixture/reconcile", { method: "POST", headers: { origin: "https://callback.example.test" } });
    const response = await handleCheckoutReconcileRoute(request(), f.checkout.id, options);
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(typeof status.verificationInProgress, "boolean");
    assert.ok(Date.parse(status.nextReconcileAt) <= Date.now());
    assert.equal(f.counts.verifications, 0, "The browser response does not wait for providers.");
    assert.ok((await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } })).nextAttemptAt.getTime() <= Date.now());
    const limited = await handleCheckoutReconcileRoute(request(), f.checkout.id, options);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("Retry-After")) > 0);
    await work[0]();
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
    assert.equal(await db.paymentTransactionEvent.count({ where: { transactionId: f.payment.id, eventType: "dpo-push" } }), 0);
    const before = { ...f.counts };
    const read = await checkoutStatusResponse((await authorize(request(), f.checkout.id))!, db);
    assert.equal((await read.json()).isComplete, true);
    assert.deepEqual(f.counts, before, "Status reads never invoke a provider.");
    assert.equal((await handleCheckoutReconcileRoute(new Request(request().url, { method: "POST", headers: { origin: "https://untrusted.example" } }), f.checkout.id, options)).status, 403);
    assert.equal((await handleCheckoutReconcileRoute(request(), f.checkout.id, { ...options, authorize: async () => null })).status, 404);
  });

  await t.test("a paid notification arriving during verification survives the lease and backoff", async () => {
    const f = await fixture();
    await db.lifecycleJob.update({ where: { id: f.job.id }, data: { nextAttemptAt: new Date(0) } });
    const claimed = await claimJob(db, f.job.id);
    assert.ok(claimed);
    await requestPaymentProcessing(f.payment.id, db, "dpo_push");
    await finishJob(db, claimed, "retry", "incomplete");
    const queued = await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } });
    assert.equal(queued.status, "pending");
    assert.ok(queued.wakeVersion > claimed.wakeVersion);
    assert.equal(jobEligibleAt(queued), claimed.lastAttemptAt!.getTime() + 15_000);
    await requestPaymentProcessing(f.payment.id, db, "browser");
    assert.equal(jobEligibleAt(await db.lifecycleJob.findUniqueOrThrow({ where: { id: f.job.id } })), jobEligibleAt(queued), "A repeated signal cannot move the cooldown back.");
    // Advance only fixture timestamps; no real fifteen-second sleep is needed.
    await db.lifecycleJob.update({ where: { id: f.job.id }, data: { lastAttemptAt: new Date(Date.now() - 16_000), nextAttemptAt: new Date(0) } });
    await processPaymentWorkflow(f.payment.id, db, f.options);
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

  await t.test("deadline signals bound provider calls and retry waits without replacing shorter timeouts", async () => {
    await withProcessingContext({ trigger: "browser", correlationId: "fixture-deadline", deadline: Date.now() + 15 }, async () => {
      const signal = providerSignal(30_000);
      await assert.rejects(processingWait(1000));
      assert.equal(signal.aborted, true);
    });
    await withProcessingContext({ trigger: "browser", correlationId: "fixture-local-timeout", deadline: Date.now() + 30_000 }, async () => {
      const signal = providerSignal(5);
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(signal.aborted, true);
    });
  });


  await t.test("authenticated async supplier completion wakes installation and receipt before the next cron", async () => {
    const f = await fixture();
    const requestId = `async-${f.checkout.id}`;
    Object.assign(f.airalo, { createOrderAsyncResponse: async () => {
      f.counts.purchases++;
      return SubmitOrderAsyncResponseSchema.parse({ status: true, data: { request_id: requestId, accepted_at: new Date().toISOString() }, meta: { message: "accepted" } });
    } });
    const options = { ...f.options, airaloOptions: { ...f.options.airaloOptions, submissionMode: "async" as const, asyncWebhookUrl: "https://callback.example.test/api/airalo/webhooks?airalo_webhook_secret=supplier-fixture-secret" } };
    await requestPaymentProcessing(f.payment.id, db, "dpo_push");
    await processPaymentCallback(f.payment.id, db, options);
    const order = await db.esimOrder.findFirstOrThrow({ where: { paymentTransactionId: f.payment.id } });
    assert.equal(order.status, "pending");
    assert.equal(f.counts.purchases, 1);
    assert.equal(f.counts.receipts, 0);
    const earlyReceipt = await queueOrderReceipt(db, order.id);
    assert.ok(earlyReceipt);
    assert.equal(await deliverReceipt(db, earlyReceipt.id, options.receiptOptions), "pending");
    assert.ok((await db.receiptDelivery.findUniqueOrThrow({ where: { id: earlyReceipt.id } })).nextAttemptAt.getTime() > Date.now());

    const work: Array<() => Promise<void>> = [];
    let hydrations = 0;
    const originalSim = f.airalo.getSimResponse;
    f.airalo.getSimResponse = async (...args) => { hydrations++; return originalSim(...args); };
    const request = (secret = "supplier-fixture-secret") => new Request(`https://callback.example.test/api/airalo/webhooks?airalo_webhook_secret=${secret}`, {
      method: "POST", headers: { "content-type": "application/json", "x-airalo-event-id": `event-${f.checkout.id}` },
      body: JSON.stringify({ event: "order.processed", data: { order_id: f.supplierOrder.data.order_id, request_id: requestId, package_id: "callback-fixture", status: "completed", iccid: f.supplierOrder.data.iccid } }),
    });
    const deps = { prisma: db, afterResponse: (task: () => Promise<void>) => { work.push(task); },
      processOrder: (id: string, client = db) => processOrderDelivery(id, client, { ...options, trigger: "supplier_webhook" as const }) };
    assert.equal((await handleAiraloWebhookRoute(request("wrong"), deps)).status, 401);
    assert.equal(work.length, 0);
    assert.equal((await handleAiraloWebhookRoute(request(), deps)).status, 200);
    assert.equal(hydrations, 0, "Supplier acknowledgement does not wait for installation.");
    assert.equal(f.counts.receipts, 0, "Supplier acknowledgement does not wait for email.");
    assert.equal((await db.receiptDelivery.findUniqueOrThrow({ where: { id: earlyReceipt.id } })).nextAttemptAt.getTime() <= Date.now(), true);
    await work[0]();
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
    assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `ack_payment:${f.payment.id}` } })).status, "done");
    assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `complete_installation:${order.id}` } })).status, "done");
    assert.equal((await db.receiptDelivery.findUniqueOrThrow({ where: { id: earlyReceipt.id } })).status, "accepted");
    assert.equal((await handleAiraloWebhookRoute(request(), deps)).status, 200);
    await Promise.all([work[1](), processPaymentWorkflow(f.payment.id, db, options)]);
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
    assert.equal(await db.esimOrder.count({ where: { paymentTransactionId: f.payment.id } }), 1);
  });

  await t.test("email outages retain their backoff and do not block DPO acknowledgement", async () => {
    const f = await fixture();
    let sends = 0;
    const options = { ...f.options, receiptOptions: { ...f.options.receiptOptions, send: async () => { sends++; throw new Error("Fixture email outage"); } } };
    await requestPaymentProcessing(f.payment.id, db, "browser");
    await processPaymentWorkflow(f.payment.id, db, options);
    const order = await db.esimOrder.findFirstOrThrow({ where: { paymentTransactionId: f.payment.id } });
    const receipt = await db.receiptDelivery.findFirstOrThrow({ where: { orderId: order.id } });
    assert.equal(sends, 1);
    assert.equal(receipt.status, "pending");
    assert.equal((await db.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `ack_payment:${f.payment.id}` } })).status, "done");
    await requestOrderProcessing(order.id, db);
    const after = await wakeOrderReceipt(db, order.id);
    assert.equal(after!.nextAttemptAt.getTime(), receipt.nextAttemptAt.getTime());
    await processOrderDelivery(order.id, db, options);
    assert.equal(sends, 1);
  });


  await t.test("a readiness wakeup during email acceptance preserves its lease and sends once", async () => {
    const f = await fixture();
    let entered!: () => void;
    let release!: () => void;
    const sending = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const options = { ...f.options, receiptOptions: { ...f.options.receiptOptions, send: async () => {
      f.counts.receipts++; entered(); await gate; return { id: "fixture-single-accepted-message", skipped: false };
    } } };
    await requestPaymentProcessing(f.payment.id, db);
    const processing = processPaymentWorkflow(f.payment.id, db, options);
    await sending;
    const order = await db.esimOrder.findFirstOrThrow({ where: { paymentTransactionId: f.payment.id } });
    try {
      const claimed = await db.receiptDelivery.findFirstOrThrow({ where: { orderId: order.id } });
      const woken = await wakeOrderReceipt(db, order.id);
      assert.equal(woken!.status, "leased");
      assert.equal(woken!.leaseToken, claimed.leaseToken);
      assert.equal(woken!.wakeVersion, claimed.wakeVersion + 1);
    } finally { release(); }
    await processing;
    await requestOrderProcessing(order.id, db);
    await processOrderDelivery(order.id, db, options);
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
    assert.equal((await db.receiptDelivery.findFirstOrThrow({ where: { orderId: order.id } })).status, "accepted");
  });

  await t.test("persisted callback work survives loss of the after task and late task replay", async () => {
    const f = await fixture();
    assert.equal((await f.push()).status, 200);
    assert.deepEqual(f.counts, { verifications: 0, purchases: 0, receipts: 0 });
    await processPaymentWorkflow(f.payment.id, db, { ...f.options, trigger: "recovery" });
    await f.work[0]();
    assert.deepEqual(f.counts, { verifications: 1, purchases: 1, receipts: 1 });
  });

});
