import { reconcilePayment } from "../jobs/lifecycle";
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
import { createQuotedCheckout as createCheckout } from "./testing/quoted-checkout";
import { verifyCheckoutPayment, verifyPaymentTransaction } from "./checkouts";
import { getActiveDpoMode, saveDpoMode } from "./dpo-settings";
import { handleDpoPushPayment } from "./dpo-ipn";

test("DPO sandbox: migration, persistent mode, audit atomicity and verification across gateway switches", { timeout: 120000 }, async t => {
  // Use only an isolated database and mock provider transport, never DATABASE_URL.
  const directory = mkdtempSync(join(tmpdir(), "sim-africa-dpo-"));
  const sql = await PGlite.create();
  // Allow a closing socket to overlap the replacement client during the reconnect assertion.
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0, maxConnections: 2 });
  const resources: { db?: PrismaClient } = {};
  const overrides: Record<string, string> = {
    AFFILIATE_PROGRAM_ENABLED: "false",
    DPO_TEST_COMPANY_TOKEN: "test-company",
    DPO_TEST_SERVICE_TYPE: "test-service",
    DPO_LIVE_COMPANY_TOKEN: "live-company",
    DPO_LIVE_SERVICE_TYPE: "live-service",
    DPO_SERVICE_URL: "https://dpo.example/API/v6",
    DPO_PAYMENT_URL: "https://pay.example",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, overrides);
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (resources.db) await resources.db.$disconnect();
    await server.stop();
    await sql.close();
    rmSync(directory, { recursive: true, force: true });
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  });

  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
    .replace(/^(?:enum DpoMode|model DpoSettings) \{[\s\S]*?^}\s*/gm, "")
    .replace(/^\s+dpoMode\s+[^\n]*\n/gm, "");
  const baseline = join(directory, "before.prisma");
  writeFileSync(baseline, schema);
  const diff = spawnSync(process.execPath, [fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "diff", "--from-empty", "--to-schema-datamodel", baseline, "--script"], { encoding: "utf8" });
  assert.equal(diff.status, 0, diff.stderr);
  await sql.exec(diff.stdout);
  await sql.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    INSERT INTO "PaymentTransaction" (id, provider, "amountCents", currency, "updatedAt")
      VALUES ('legacy-dpo', 'dpo', 1000, 'USD', CURRENT_TIMESTAMP), ('other-provider', 'other', 1000, 'USD', CURRENT_TIMESTAMP);
  `);
  await sql.exec(readFileSync(new URL("../../prisma/migration-history/migrations/20261019120000_add_dpo_gateway_mode/migration.sql", import.meta.url), "utf8"));
  await server.start();
  const databaseUrl = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30`;
  let db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  resources.db = db;
  const actorEmail = "admin@example.test";

  await t.test("migration starts in test, backfills DPO payments and restricts settings access", async () => {
    assert.equal(await getActiveDpoMode(db), "test");
    assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: "legacy-dpo" } })).dpoMode, "test");
    assert.equal((await db.paymentTransaction.findUniqueOrThrow({ where: { id: "other-provider" } })).dpoMode, null);
    const access = await sql.query<{ rls: boolean; anon: boolean; authenticated: boolean }>(`
      SELECT relrowsecurity AS rls,
        has_table_privilege('anon', '"DpoSettings"', 'SELECT,INSERT,UPDATE,DELETE') AS anon,
        has_table_privilege('authenticated', '"DpoSettings"', 'SELECT,INSERT,UPDATE,DELETE') AS authenticated
      FROM pg_class WHERE relname = 'DpoSettings'
    `);
    assert.deepEqual(access.rows, [{ rls: true, anon: false, authenticated: false }]);
    await assert.rejects(sql.query('INSERT INTO "DpoSettings" (id, "updatedAt") VALUES ($1, CURRENT_TIMESTAMP)', ["second"]), /constraint/);
  });

  await t.test("switches persist and audit only real changes; invalid configuration leaves the mode untouched", async () => {
    await saveDpoMode("live", actorEmail, db);
    // PGlite exposes one connection at a time; reconnect to prove persistence.
    await db.$disconnect();
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    resources.db = db;
    assert.equal(await getActiveDpoMode(db), "live");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "payments.dpo.mode-changed" } });
    assert.deepEqual(JSON.parse(log.details!), { previousMode: "test", mode: "live", actorEmail });
    assert.doesNotMatch(log.details!, /test-company|live-company|test-service|live-service/);
    await saveDpoMode("live", actorEmail, db);
    assert.equal(await db.auditLog.count(), 1);
    await assert.rejects(saveDpoMode("invalid", actorEmail, db), /Choose test or live/);
    process.env.DPO_TEST_SERVICE_TYPE = "";
    await assert.rejects(saveDpoMode("test", actorEmail, db), /not fully configured/);
    assert.equal(await getActiveDpoMode(db), "live");
    assert.equal(await db.auditLog.count(), 1);
    process.env.DPO_TEST_SERVICE_TYPE = overrides.DPO_TEST_SERVICE_TYPE;
    await saveDpoMode("test", actorEmail, db);
  });

  await t.test("an audit failure rolls back the mode change", async () => {
    await sql.exec(`
      CREATE FUNCTION reject_dpo_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Simulated audit failure'; END; $$;
      CREATE TRIGGER reject_dpo_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_dpo_audit();
    `);
    try {
      await assert.rejects(saveDpoMode("live", actorEmail, db), /Simulated audit failure/);
      assert.equal(await getActiveDpoMode(db), "test");
    } finally {
      await sql.exec('DROP TRIGGER reject_dpo_audit ON "AuditLog"; DROP FUNCTION reject_dpo_audit();');
    }
  });

  const country = await db.country.create({ data: { countryCode: "NA", slug: "namibia", title: "Namibia" } });
  const operator = await db.operator.create({ data: { countryId: country.id, title: "Sandbox", info: [] } });
  const makePackage = (type: string, externalId: string) => db.package.create({ data: {
    operatorId: operator.id, airaloPackageId: externalId, type, title: "Namibia 1 GB", amount: 1024, data: "1 GB", day: 7,
    price: 20, pricesRecommendedRetailPrice: { USD: 20, ZAR: 328, GBP: 15, EUR: 18 }, netPrice: 10, pricesNetPrice: { USD: { amount: 10 } }, manualInstallation: "", qrInstallation: "",
    state: { create: { sellingPriceCents: 2000, basePriceCents: 1000, currencyCode: "USD", isActive: true, lastSyncedAt: new Date() } },
  } });
  const purchasePackage = await makePackage("sim", "dpo-sandbox-sim");
  const topUpPackage = await makePackage("topup", "dpo-sandbox-topup");
  const topUpOwner = await db.user.create({ data: { email: "dpo-topup@example.test", emailProofAt: new Date(), emailProofSource: "email", } });
  await db.esimOrder.create({ data: { id: "original-order", userId: topUpOwner.id, packageId: purchasePackage.id, status: "completed", profiles: { create: { iccid: "8900000000000000001", status: "active" } } } });
  const requests: string[] = [];
  let creations = 0;
  let switchDuringCreation = true;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://dpo.example/API/v6/");
    const body = String(init?.body);
    requests.push(body);
    if (body.includes("<Request>createToken</Request>")) {
      creations++;
      if (switchDuringCreation) {
        switchDuringCreation = false;
        await saveDpoMode("live", actorEmail, db);
      }
      return new Response(`<API3G><Result>000</Result><TransToken>token-${creations}</TransToken><TransRef>ref-${creations}</TransRef></API3G>`);
    }
    // Pending verification exercises real credential selection without creating a supplier order.
    return new Response("<API3G><Result>001</Result><ResultExplanation>Pending</ResultExplanation></API3G>");
  };

  await t.test("purchases and top-ups freeze the mode and use it for polling and repeated push verification", async () => {
    const purchase = await createCheckout({ packageId: purchasePackage.id, customerEmail: "customer@example.test", metadata: { dpoMode: "live" } }, { prisma: db, baseUrl: "https://shop.example.test" });
    assert.equal(await getActiveDpoMode(db), "live");
    const testPayment = await db.paymentTransaction.findFirstOrThrow({ where: { checkoutId: purchase.checkoutId } });
    assert.equal(testPayment.dpoMode, "test", "a switch while DPO is responding cannot relabel the payment");
    assert.equal(purchase.paymentUrl, "https://pay.example/payv2.php?ID=token-1");
    assert.match(requests.at(-1)!, /<CompanyToken>test-company<\/CompanyToken>/);
    assert.match(requests.at(-1)!, /<ServiceType>test-service<\/ServiceType>/);
    await verifyCheckoutPayment(purchase.checkoutId, { prisma: db });
    assert.match(requests.at(-1)!, /<CompanyToken>test-company<\/CompanyToken>/);

    const topUp = await createCheckout({ packageId: topUpPackage.id, customerEmail: "customer@example.test", intent: "top-up", topUpForOrderId: "original-order", topUpForIccid: "8900000000000000001" }, { prisma: db, userId: topUpOwner.id, baseUrl: "https://shop.example.test" });
    const livePayment = await db.paymentTransaction.findFirstOrThrow({ where: { checkoutId: topUp.checkoutId } });
    assert.equal(livePayment.dpoMode, "live");
    assert.match(requests.at(-1)!, /<CompanyToken>live-company<\/CompanyToken>/);
    assert.match(requests.at(-1)!, /<ServiceType>live-service<\/ServiceType>/);
    await saveDpoMode("test", actorEmail, db);
    await verifyPaymentTransaction(livePayment.id, { prisma: db, source: "dpo-push" });
    assert.match(requests.at(-1)!, /<CompanyToken>live-company<\/CompanyToken>/);

    const deps = {
      findPaymentTransactionByToken: async () => livePayment,
      findPaymentTransactionByReference: async () => livePayment,
      findPaymentTransactionByCheckoutId: async () => livePayment,
      recordPaymentEvent: async (id: string, eventType: string, payload: unknown) => {
        await db.paymentTransactionEvent.create({ data: { transactionId: id, eventType, payload: JSON.stringify(payload) } });
      },
      verifyPaymentTransaction: async (id: string) => { await reconcilePayment(id, db); return { paymentStatus: "pending" }; },
    };
    for (let replay = 0; replay < 2; replay++) {
      const result = await handleDpoPushPayment({ rawBody: `<API3G><TransactionToken>${livePayment.transactionToken}</TransactionToken></API3G>`, contentType: "application/xml", deps });
      assert.equal(result.status, 200);
      assert.match(requests.at(-1)!, /<CompanyToken>live-company<\/CompanyToken>/);
    }
    assert.equal(await db.esimOrder.count({ where: { id: { not: "original-order" } } }), 0);

    process.env.DPO_LIVE_COMPANY_TOKEN = "";
    const requestCount = requests.length;
    const failedVerification = await verifyPaymentTransaction(livePayment.id, { prisma: db });
    assert.equal(failedVerification.retryable, true);
    assert.equal(requests.length, requestCount, "missing live credentials must not use the active test account");
    process.env.DPO_LIVE_COMPANY_TOKEN = overrides.DPO_LIVE_COMPANY_TOKEN;
    await db.paymentTransaction.update({ where: { id: livePayment.id }, data: { dpoMode: null } });
    assert.equal((await verifyPaymentTransaction(livePayment.id, { prisma: db })).retryable, true);
    assert.equal(requests.length, requestCount, "an unknown payment mode must not use the active account");
  });

  await t.test("missing active credentials or settings create no checkout or provider request", async () => {
    const checkouts = await db.checkoutSession.count();
    const requestCount = requests.length;
    process.env.DPO_TEST_SERVICE_TYPE = "";
    await assert.rejects(createCheckout({ packageId: purchasePackage.id }, { prisma: db, baseUrl: "https://shop.example.test" }), /not fully configured/);
    process.env.DPO_TEST_SERVICE_TYPE = overrides.DPO_TEST_SERVICE_TYPE;
    await db.dpoSettings.delete({ where: { id: "dpo" } });
    await assert.rejects(createCheckout({ packageId: purchasePackage.id }, { prisma: db, baseUrl: "https://shop.example.test" }), /settings are unavailable/);
    await assert.rejects(saveDpoMode("live", actorEmail, db), /settings are unavailable/);
    assert.equal(await db.checkoutSession.count(), checkouts);
    assert.equal(requests.length, requestCount);
  });
});
