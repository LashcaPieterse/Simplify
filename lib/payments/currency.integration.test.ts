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
import { CURRENCIES } from "../currency";
import { createCheckoutQuote, assertQuoteOwner } from "./quotes";
import { createCheckout } from "./checkouts";

test("currency checkout: additive migration, frozen NAD quotes, ownership and duplicate payment prevention", { timeout: 120000 }, async t => {
  // Isolated Postgres-compatible database; no real gateway or configured DATABASE_URL is used.
  const directory = mkdtempSync(join(tmpdir(), "sim-africa-currency-"));
  const sql = await PGlite.create();
  const server = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0 });
  const resources: { db?: PrismaClient } = {};
  const overrides = { AFFILIATE_PROGRAM_ENABLED: "false", DPO_TEST_COMPANY_TOKEN: "fixture", DPO_TEST_SERVICE_TYPE: "fixture" };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  t.after(async () => {
    await resources.db?.$disconnect(); await server.stop(); await sql.close(); rmSync(directory, { recursive: true, force: true });
    for (const key of Object.keys(overrides)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  });
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
    .replace(/^model CheckoutQuote \{[\s\S]*?^}\s*/gm, "")
    .replace(/^\s+(?:quoteId|quote|checkoutQuotes|preferredCurrency)\s+[^\n]*\n/gm, "");
  const baseline = join(directory, "before.prisma"); writeFileSync(baseline, schema);
  const diff = spawnSync(process.execPath, [fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "diff", "--from-empty", "--to-schema-datamodel", baseline, "--script"], { encoding: "utf8" });
  assert.equal(diff.status, 0, diff.stderr);
  await sql.exec(diff.stdout);
  await sql.exec('INSERT INTO "PaymentTransaction" (id,provider,"amountCents",currency,"updatedAt") VALUES (\'legacy-usd\',\'dpo\',1500,\'USD\',CURRENT_TIMESTAMP)');
  await sql.exec(readFileSync(new URL("../../prisma/migration-history/migrations/20261021160000_add_currency_quotes/migration.sql", import.meta.url), "utf8"));
  await server.start();
  const database = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30` } } }); resources.db = database;
  await database.dpoSettings.create({ data: { id: "dpo" } });
  const user = await database.user.create({ data: { email: "currency@example.test", emailProofAt: new Date(), emailProofSource: "email", preferredCurrency: "GBP" } });
  const country = await database.country.create({ data: { countryCode: "NA", slug: "namibia", title: "Namibia" } });
  const operator = await database.operator.create({ data: { countryId: country.id, title: "Fixture", info: [] } });
  const retail = { USD: 15, EUR: 13.35, GBP: 11.25, ZAR: 246 };
  const pkg = await database.package.create({ data: { operatorId: operator.id, airaloPackageId: "currency-fixture", type: "sim", title: "Fixture 1 GB", amount: 1024, data: "1 GB", day: 7, price: 15, manualInstallation: "", qrInstallation: "", pricesRecommendedRetailPrice: retail, state: { create: { sellingPriceCents: 1500, currencyCode: "USD", lastSyncedAt: new Date(), isActive: true } } } });
  const owner = { guestSessionId: "isolated-guest-session" };
  const options = { prisma: database, baseUrl: "https://shop.example.test", ...owner };
  let calls = 0;
  const dpoClient = { createTransaction: async (input: { amount: number; currency: string }) => { calls++; assert.equal(input.amount, 246); assert.equal(input.currency, "NAD"); return { token: `fixture-${calls}`, redirectUrl: `https://pay.example/${calls}`, rawResponse: {} }; } };

  await t.test("all five display currencies charge the package ZAR amount in NAD", async () => {
    for (const currency of CURRENCIES) {
      const quote = await createCheckoutQuote({ packageId: pkg.id, currency }, owner, database);
      const result = await createCheckout({ packageId: pkg.id, quoteId: quote.id, customerEmail: "customer@example.test" }, { ...options, dpoClient });
      const checkout = await database.checkoutSession.findUniqueOrThrow({ where: { id: result.checkoutId }, include: { payments: true, quote: true } });
      assert.equal(checkout.currency, "NAD"); assert.equal(checkout.totalCents, 24600);
      assert.equal(checkout.payments[0].amountCents, 24600); assert.equal(checkout.payments[0].currency, "NAD");
      assert.equal(checkout.quote!.displayCurrency, currency);
      const before = calls;
      assert.deepEqual(await createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient }), result);
      assert.equal(calls, before);
    }
    assert.equal((await database.paymentTransaction.findUniqueOrThrow({ where: { id: "legacy-usd" } })).currency, "USD");
  });

  await t.test("expired, altered and foreign-session quotes never reach the gateway", async () => {
    const quote = await createCheckoutQuote({ packageId: pkg.id }, owner, database);
    const before = calls;
    await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, guestSessionId: "other-browser", dpoClient }), /not available in this session/);
    await database.checkoutQuote.update({ where: { id: quote.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient }), /expired or changed/);
    const changed = await createCheckoutQuote({ packageId: pkg.id }, owner, database);
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: { ...retail, ZAR: 250 } } });
    await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: changed.id }, { ...options, dpoClient }), /expired or changed/);
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: retail } });
    assert.equal(calls, before);
    assert.throws(() => assertQuoteOwner({ userId: user.id, guestSessionHash: null }, owner), /not available/);
    await assert.rejects(createCheckoutQuote({ packageId: pkg.id, currency: "JPY" as "USD" }, owner, database));
    await assert.rejects(createCheckout({ packageId: pkg.id }, { ...options, dpoClient }), /Review a price quote/);
  });

  await t.test("an ambiguous gateway failure cannot create a second token", async () => {
    const quote = await createCheckoutQuote({ packageId: pkg.id }, owner, database);
    let attempts = 0;
    const failing = { createTransaction: async () => { attempts++; throw new Error("Provider connection interrupted"); } };
    await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient: failing }), /interrupted/);
    await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient: failing }), /being checked/);
    assert.equal(attempts, 1);
  });

  await t.test("concurrent submissions reserve a single checkout before contacting DPO", async () => {
    const quote = await createCheckoutQuote({ packageId: pkg.id }, owner, database);
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    let creations = 0;
    const slowDpo = { createTransaction: async () => { creations++; started(); await hold; return { token: "slow-token", redirectUrl: "https://pay.example/slow", rawResponse: {} }; } };
    const first = createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient: slowDpo });
    await entered;
    try {
      await assert.rejects(createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient: slowDpo }), /being checked|being prepared/);
    } finally { release(); }
    const result = await first;
    // A catalog update and quote expiry cannot change an existing transaction.
    await database.checkoutQuote.update({ where: { id: quote.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: { ...retail, ZAR: 999 } } });
    assert.deepEqual(await createCheckout({ packageId: pkg.id, quoteId: quote.id }, { ...options, dpoClient: slowDpo }), result);
    assert.equal(creations, 1);
    assert.equal(await database.checkoutSession.count({ where: { quoteId: quote.id } }), 1);
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: retail } });
  });

  await t.test("missing ZAR, stale catalog and the creation switch prevent new payments", async () => {
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: { USD: 15 } } });
    await assert.rejects(createCheckoutQuote({ packageId: pkg.id }, owner, database), /no current NAD retail price/);
    await database.package.update({ where: { id: pkg.id }, data: { pricesRecommendedRetailPrice: retail, state: { update: { lastSyncedAt: new Date(0) } } } });
    await assert.rejects(createCheckoutQuote({ packageId: pkg.id }, owner, database), /no current NAD retail price/);
    await database.package.update({ where: { id: pkg.id }, data: { state: { update: { lastSyncedAt: new Date() } } } });
    const previousFlag = process.env.CHECKOUT_CREATION_ENABLED;
    process.env.CHECKOUT_CREATION_ENABLED = "false";
    try { await assert.rejects(createCheckoutQuote({ packageId: pkg.id }, owner, database), /temporarily unavailable/); }
    finally { if (previousFlag === undefined) delete process.env.CHECKOUT_CREATION_ENABLED; else process.env.CHECKOUT_CREATION_ENABLED = previousFlag; }
    const fallback = await createCheckoutQuote({ packageId: pkg.id, currency: "GBP" }, owner, database);
    assert.equal(fallback.displayCurrency, "GBP");
  });

  await t.test("top-ups require the original account and supplier eligibility", async () => {
    const topup = await database.package.create({ data: { operatorId: operator.id, airaloPackageId: "currency-fixture-topup", type: "topup", title: "Fixture top-up", amount: 1024, data: "1 GB", day: 7, price: 15, manualInstallation: "", qrInstallation: "", pricesRecommendedRetailPrice: retail, state: { create: { sellingPriceCents: 1500, currencyCode: "USD", lastSyncedAt: new Date(), isActive: true } } } });
    const original = await database.esimOrder.create({ data: { userId: user.id, packageId: pkg.id, status: "completed", profiles: { create: { iccid: "8900000000099990001", status: "active" } } } });
    const airaloClient = { getSimTopUpPackages: async () => [{ id: topup.airaloPackageId, price: 15 }] } as unknown as AiraloClient;
    await assert.rejects(createCheckoutQuote({ packageId: topup.id, intent: "top-up", topUpForOrderId: original.id }, owner, database, { airaloClient }), /Sign in/);
    const quote = await createCheckoutQuote({ packageId: topup.id, intent: "top-up", topUpForOrderId: original.id, currency: "GBP" }, { userId: user.id }, database, { airaloClient });
    const result = await createCheckout({ packageId: topup.id, quoteId: quote.id, intent: "top-up" }, { ...options, userId: user.id, dpoClient, topUpAiraloClient: airaloClient });
    const checkout = await database.checkoutSession.findUniqueOrThrow({ where: { id: result.checkoutId } });
    assert.equal(checkout.topUpForOrderId, original.id); assert.equal(checkout.topUpForIccid, "8900000000099990001"); assert.equal(checkout.currency, "NAD");
  });
});
