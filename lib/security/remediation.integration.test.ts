import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import { recordEmailProof, verifiedOAuthEmail } from "../auth/ownership-proof";
import { authOptions } from "../auth/options";
import { commitPaymentTransition, paymentState } from "../payments/transitions";
import { enqueueJob, claimJob, finishJob } from "../jobs/store";
import { seedLifecycleWork, runLifecycleJob } from "../jobs/lifecycle";
import type { AiraloClient } from "../airalo/client";
import { OrderResponseSchema } from "../airalo/schemas";
import { queueOrderReceipt, deliverReceipt, reviewReceipt } from "../notifications/receipt-outbox";
import { EmailSendError } from "../notifications/email";
import { enforceRates, trustedClientIp, AbuseError } from "./rate-limit";
import { createScopedAccessToken, verifyScopedAccessToken } from "../orders/access";
import { readBoundedText, BodyError } from "../http/bounded-body";
import { verifyMigrationArchive, verifyBaselineObjects } from "../db/provisioning";

test("remediation: clean baseline, proof lifecycle, atomic transitions, durable delivery and shared quotas", { timeout: 120_000 }, async t => {
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const resources: { db?: PrismaClient } = {};
  const previousSecret = process.env.NEXTAUTH_SECRET;
  const previousAccess = process.env.ORDER_ACCESS_SECRET;
  const previousRate = process.env.RATE_LIMIT_SECRET;
  process.env.NEXTAUTH_SECRET = "isolated-remediation-fixture-secret";
  process.env.ORDER_ACCESS_SECRET = "isolated-remediation-access-secret";
  process.env.RATE_LIMIT_SECRET = "isolated-remediation-rate-secret";
  t.after(async () => {
    if (resources.db) await resources.db.$disconnect();
    await server.stop(); await sql.close();
    for (const [key, value] of [["NEXTAUTH_SECRET", previousSecret], ["ORDER_ACCESS_SECRET", previousAccess], ["RATE_LIMIT_SECRET", previousRate]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  });
  // Execute the actual active migration files, rather than generating today's schema.
  await sql.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => /^\d/.test(name)).sort()) {
    await sql.exec(readFileSync(new URL(`${name}/migration.sql`, directory), "utf8"));
  }
  assert.ok(verifyMigrationArchive() > 20);
  await server.start();
  const database = resources.db = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30` } } });
  await verifyBaselineObjects(database);
  const country = await database.country.create({ data: { countryCode: "NA", slug: "proof-fixture", title: "Fixture" } });
  const operator = await database.operator.create({ data: { countryId: country.id, title: "Fixture", info: [] } });
  const pkg = await database.package.create({ data: { operatorId: operator.id, airaloPackageId: "proof-fixture", type: "sim", title: "Fixture plan", amount: 1024, data: "1 GB", day: 7, price: 10, manualInstallation: "", qrInstallation: "" } });

  await t.test("link requests and unverified OAuth claims cannot establish ownership", async () => {
    const allowed = await authOptions.callbacks!.signIn!({ user: { id: "not-a-database-user", email: "victim@example.test" }, account: { provider: "email", type: "email", providerAccountId: "victim@example.test" }, email: { verificationRequest: true } });
    assert.equal(allowed, true);
    assert.equal(await database.user.count(), 0);
    assert.equal(verifiedOAuthEmail("google", { email: "victim@example.test", email_verified: false }, "victim@example.test"), false);
    assert.equal(verifiedOAuthEmail("google", { email: "attacker@example.test", email_verified: true }, "victim@example.test"), false);
    assert.equal(verifiedOAuthEmail("apple", { email: "VICTIM@example.test", email_verified: "true" }, "victim@example.test"), true);
  });

  await t.test("fresh proof resets unsafe credentials and claims only matching unowned records", async () => {
    const user = await database.user.create({ data: { email: "victim@example.test", passwordHash: "attacker-chosen-hash", emailVerifiedAt: new Date(), recoveryRequired: true, passwordResetRequired: true } });
    await database.userIdentity.create({ data: { userId: user.id, provider: "google", providerUserId: "untrusted-old-identity" } });
    const matching = await database.esimOrder.create({ data: { packageId: pkg.id, customerEmail: "VICTIM@example.test" } });
    const mismatched = await database.esimOrder.create({ data: { packageId: pkg.id, userId: user.id, customerEmail: "other@example.test", ownershipReviewRequired: true } });
    const proven = await recordEmailProof(database, { userId: user.id, email: "victim@example.test", source: "email" });
    assert.equal(proven.authVersion, 1); assert.equal(proven.passwordHash, null); assert.equal(proven.passwordResetRequired, true);
    assert.ok(proven.emailProofAt);
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: matching.id } })).userId, user.id);
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: mismatched.id } })).ownershipReviewRequired, true);
    assert.equal((await database.userIdentity.findFirstOrThrow({ where: { userId: user.id } })).quarantined, true);
    const token = createScopedAccessToken("order", matching.id, { accessVersion: 0 });
    assert.equal(verifyScopedAccessToken(token, "order", matching.id, { accessVersion: 1 }), false);
    await assert.rejects(recordEmailProof(database, { userId: user.id, email: "other@example.test", source: "email" }), /does not match/);
  });

  await t.test("first proof invalidates preregistered passwords even before quarantine activation", async () => {
    const user = await database.user.create({ data: { email: "unquarantined@example.test", passwordHash: "untrusted-hash", emailVerifiedAt: new Date() } });
    const proof = await recordEmailProof(database, { userId: user.id, email: user.email, source: "email" });
    assert.equal(proof.passwordHash, null); assert.equal(proof.passwordResetRequired, true); assert.equal(proof.authVersion, 1);
  });

  await t.test("bounded historical seeding progresses past already queued records", async () => {
    const payments = await Promise.all(Array.from({ length: 3 }, () => database.paymentTransaction.create({ data: { provider: "dpo", amountCents: 1000, currency: "NAD", status: "authorized" } })));
    for (let tick = 0; tick < 3; tick++) await seedLifecycleWork(database, 1);
    for (const payment of payments) assert.ok(await database.lifecycleJob.findUnique({ where: { businessKey: `verify_payment:${payment.id}` } }));
  });

  await t.test("baseline adoption rejects replaced constraints with the same name", async () => {
    await database.$executeRawUnsafe('ALTER TABLE "User" DROP CONSTRAINT "User_preferredCurrency_check"');
    await database.$executeRawUnsafe('ALTER TABLE "User" ADD CONSTRAINT "User_preferredCurrency_check" CHECK (true)');
    await assert.rejects(verifyBaselineObjects(database), /parity failed/);
    await database.$executeRawUnsafe('ALTER TABLE "User" DROP CONSTRAINT "User_preferredCurrency_check"');
    const sql = readFileSync("prisma/migrations/20261023170000_security_baseline/migration.sql", "utf8");
    const definition = sql.match(/ALTER TABLE "User" ADD CONSTRAINT "User_preferredCurrency_check"[^;]+;/)?.[0];
    assert.ok(definition);
    await database.$executeRawUnsafe(definition);
    await verifyBaselineObjects(database);
  });

  await t.test("approval dominates delayed observations and events remain append-only", async () => {
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, totalCents: 1000, currency: "NAD" } });
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", dpoMode: "test", amountCents: 1000, currency: "NAD" } });
    const transition = (code: string) => commitPaymentTransition(database, { paymentId: payment.id, status: paymentState(code), providerCode: code, source: "fixture", payload: JSON.stringify({ code }) });
    await Promise.all([transition("000"), transition("900")]);
    await transition("901"); await transition("000");
    const current = await database.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(current.status, "approved"); assert.ok(current.approvedAt);
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).status, "paid");
    const events = await database.paymentTransactionEvent.findMany({ where: { transactionId: payment.id }, orderBy: { transitionVersion: "asc" } });
    assert.ok(events.some(event => event.toStatus === "approved"));
    assert.equal(events.at(-1)?.toStatus, "approved");
    assert.equal(await database.lifecycleJob.count({ where: { businessKey: `fulfill_checkout:${checkout.id}` } }), 1);
    const job = await enqueueJob(database, "verify_payment", payment.id);
    const [one, two] = await Promise.all([claimJob(database, job.id), claimJob(database, job.id)]);
    assert.equal([one, two].filter(Boolean).length, 1);
    const claimed = one ?? two!;
    await finishJob(database, claimed, "retry");
    assert.equal((await database.lifecycleJob.findUniqueOrThrow({ where: { id: job.id } })).status, "pending");
  });

  const makeDeliverable = async () => database.esimOrder.create({ data: { packageId: pkg.id, customerEmail: "traveller@example.test", status: "completed", orderNumber: `supplier-${Math.random()}`,
    profiles: { create: { iccid: `fixture-${Math.random()}`, status: "completed", activationCode: "fixture-activation" } },
    installation: { create: { payload: JSON.stringify({ activationCode: "fixture-activation", lpa: "rsp.example.test" }) } },
  } });

  await t.test("closed-browser recovery verifies, submits once, persists receipts, then acknowledges separately", async () => {
    const checkout = await database.checkoutSession.create({ data: { packageId: pkg.id, customerEmail: "closed-browser@example.test", totalCents: 1000, currency: "NAD" } });
    const payment = await database.paymentTransaction.create({ data: { checkoutId: checkout.id, provider: "dpo", dpoMode: "live", transactionToken: "fixture-only", amountCents: 1000, currency: "NAD" } });
    let submissions = 0;
    const airalo = { createOrderResponse: async (payload: { description?: string }) => {
      submissions++; assert.match(payload.description ?? "", /\[simplify_order_id:/);
      return OrderResponseSchema.parse({ status: true, data: { order_id: "fixture-closed-browser", status: "completed", iccid: "fixture-closed-browser-iccid", activation_code: "LPA:1$rsp.example.test$fixture" } });
    } } as unknown as AiraloClient;
    const verify = await enqueueJob(database, "verify_payment", payment.id);
    assert.equal((await runLifecycleJob(database, verify.id, { dpoClient: { verifyTransaction: async (_token, reference, flags) => {
      assert.equal(reference, checkout.id); assert.notEqual(flags?.markProcessed, true);
      return { status: "000", resultCode: "000", amount: 10, currency: "NAD", rawResponse: {} };
    } } })).result, "done");
    assert.equal((await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id } })).orderId, null);
    const fulfill = await database.lifecycleJob.findUniqueOrThrow({ where: { businessKey: `fulfill_checkout:${checkout.id}` } });
    await Promise.all([1, 2].map(() => runLifecycleJob(database, fulfill.id, { airaloOptions: { airaloClient: airalo, submissionMode: "sync" } })));
    assert.equal(submissions, 1);
    const completed = await database.checkoutSession.findUniqueOrThrow({ where: { id: checkout.id }, include: { order: true } });
    assert.equal(completed.order?.status, "completed");
    assert.equal(await database.esimOrder.count({ where: { paymentTransactionId: payment.id } }), 1);
    const receipt = await database.receiptDelivery.findUniqueOrThrow({ where: { businessKey: `receipt:${completed.orderId}:v1` } });
    assert.equal(await deliverReceipt(database, receipt.id, { baseUrl: "https://fixture.example.test", send: async () => ({ id: "fixture-closed-browser-email", skipped: false }) }), "accepted");
    const acknowledgment = await enqueueJob(database, "ack_payment", payment.id);
    assert.equal((await runLifecycleJob(database, acknowledgment.id, { dpoClient: { verifyTransaction: async (_token, _reference, flags) => {
      assert.equal(flags?.markProcessed, true); return { status: "000", resultCode: "000", rawResponse: {} };
    } } })).result, "done");
  });

  await t.test("receipt payload and idempotency key survive retries; timestamps require acceptance", async () => {
    const order = await makeDeliverable();
    const job = (await queueOrderReceipt(database, order.id))!;
    let firstPayload = "";
    const result = await deliverReceipt(database, job.id, { baseUrl: "https://fixture.example.test", send: async payload => {
      firstPayload = JSON.stringify(payload); throw new Error("Response lost after acceptance");
    } });
    assert.equal(result, "pending");
    assert.equal((await database.esimOrder.findUniqueOrThrow({ where: { id: order.id } })).receiptSentAt, null);
    await database.receiptDelivery.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
    assert.equal(await deliverReceipt(database, job.id, { baseUrl: "https://changed.example.test", send: async payload => {
      assert.deepEqual(payload, JSON.parse(firstPayload)); return { id: "provider-fixture", skipped: false };
    } }), "accepted");
    assert.ok((await database.esimOrder.findUniqueOrThrow({ where: { id: order.id } })).receiptSentAt);
    assert.equal((await database.receiptDelivery.findUniqueOrThrow({ where: { id: job.id } })).providerMessageId, "provider-fixture");
  });

  await t.test("expired ambiguous receipt acceptance pauses without sending", async () => {
    const order = await makeDeliverable();
    const job = (await queueOrderReceipt(database, order.id))!;
    await database.receiptDelivery.update({ where: { id: job.id }, data: { acceptanceUnknown: true, firstAttemptAt: new Date(Date.now() - 24 * 3_600_000) } });
    assert.equal(await deliverReceipt(database, job.id, { send: async () => { throw new Error("Must not send"); } }), "review");
    await reviewReceipt(database, { id: job.id, action: "resend", actor: "operator@example.test", reason: "Independent provider review completed" });
    assert.equal(await database.receiptDelivery.count({ where: { orderId: order.id, status: "pending" } }), 1);
    await assert.rejects(reviewReceipt(database, { id: job.id, action: "resend", actor: "operator@example.test", reason: "Repeated click" }), /Only a receipt/);
  });

  await t.test("a later definite failure cannot erase an earlier ambiguous receipt acceptance", async () => {
    const order = await makeDeliverable();
    const job = (await queueOrderReceipt(database, order.id))!;
    await deliverReceipt(database, job.id, { send: async () => { throw new Error("Response lost"); } });
    await database.receiptDelivery.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
    await deliverReceipt(database, job.id, { send: async () => { throw new EmailSendError(429); } });
    assert.equal((await database.receiptDelivery.findUniqueOrThrow({ where: { id: job.id } })).acceptanceUnknown, true);
    await database.receiptDelivery.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0), firstAttemptAt: new Date(Date.now() - 24 * 3_600_000) } });
    assert.equal(await deliverReceipt(database, job.id, { send: async () => { throw new Error("Must not resend"); } }), "review");
  });

  await t.test("concurrent shared quotas use hashed identifiers and database time", async () => {
    const rule = { scope: "fixture", identifier: "private-address@example.test", limit: 3, windowSeconds: 3600 };
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => enforceRates([rule], database)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
    for (const result of results) if (result.status === "rejected") assert.ok(result.reason instanceof AbuseError && result.reason.status === 429);
    const rows = await database.rateBucket.findMany();
    assert.equal(rows.some(row => row.key.includes("private-address")), false);
    assert.throws(() => trustedClientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }), { NODE_ENV: "production" }), AbuseError);
    assert.throws(() => trustedClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), { NODE_ENV: "production", VERCEL: "1" }), AbuseError);
    assert.equal(trustedClientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }), { NODE_ENV: "production", VERCEL: "1" }), "1.2.3.4");
    const request = new Request("https://fixture.test", { method: "POST", body: "x".repeat(33 * 1024) });
    await assert.rejects(readBoundedText(request), error => error instanceof BodyError && error.status === 413);
    const brokenDatabase = { $queryRaw: async () => { throw new Error("Fixture database unavailable"); } } as unknown as PrismaClient;
    await assert.rejects(enforceRates([rule], brokenDatabase), error => error instanceof AbuseError && error.status === 503);
  });
});
