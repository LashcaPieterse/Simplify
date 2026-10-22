import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

async function main() {
  // Every database write is isolated; payment initiation is intercepted in the browser.
  const directory = mkdtempSync(join(tmpdir(), "sim-africa-currency-ui-"));
  const sql = await PGlite.create();
  const databaseServer = new PGLiteSocketServer({ db: sql, host: "127.0.0.1", port: 0, maxConnections: 4 });
  const diff = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
  assert.equal(diff.status, 0, diff.stderr);
  await sql.exec(diff.stdout); await databaseServer.start();
  // The in-process database shares protocol state across clients; avoid named-statement collisions.
  const databaseUrl = `postgresql://postgres:postgres@${databaseServer.getServerConn()}/postgres?sslmode=disable&connection_limit=1&statement_cache_size=0&pgbouncer=true`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const account = await db.user.create({ data: { email: "account-qa@example.test" } });
  const otherAccount = await db.user.create({ data: { email: "other-account-qa@example.test", preferredCurrency: "GBP" } });
  const country = await db.country.create({ data: { countryCode: "NA", slug: "namibia", title: "Namibia" } });
  const operator = await db.operator.create({ data: { countryId: country.id, title: "Currency QA", info: [] } });
  const pkg = await db.package.create({ data: {
    operatorId: operator.id, airaloPackageId: "currency-ui-plan", type: "sim", title: "Currency QA 1 GB", amount: 1024, data: "1 GB", day: 7,
    price: 15, pricesRecommendedRetailPrice: { USD: 15, EUR: 13.35, GBP: 11.25, ZAR: 246 }, manualInstallation: "", qrInstallation: "",
    state: { create: { sellingPriceCents: 1500, currencyCode: "USD", isActive: true, lastSyncedAt: new Date() } },
  } });
  await db.$disconnect();
  const portServer = createServer();
  await new Promise<void>(resolve => portServer.listen(0, "127.0.0.1", resolve));
  const address = portServer.address(); assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => portServer.close(error => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const logPath = join(tmpdir(), "simplify-currency-ui-server.log");
  const output = openSync(logPath, "w");
  const app = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: ["ignore", output, output],
    env: { ...process.env, DATABASE_URL: databaseUrl, NEXT_PUBLIC_APP_URL: origin, NEXTAUTH_URL: origin, NEXTAUTH_SECRET: "currency-ui-fixture-secret", ORDER_ACCESS_SECRET: "currency-ui-fixture-access-secret", AFFILIATE_PROGRAM_ENABLED: "false", CHECKOUT_CREATION_ENABLED: "true", AIRALO_CLIENT_ID: "", AIRALO_CLIENT_SECRET: "", DPO_TEST_COMPANY_TOKEN: "fixture", DPO_TEST_SERVICE_TYPE: "fixture", DPO_LIVE_COMPANY_TOKEN: "", DPO_LIVE_SERVICE_TYPE: "" },
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline) {
      if (app.exitCode !== null) throw new Error(`QA application exited; inspect ${logPath}`);
      try { if ((await fetch(`${origin}/api/currency-preference`)).ok) { ready = true; break; } } catch {}
      await delay(500);
    }
    assert.ok(ready, `QA application did not start; inspect ${logPath}`);
    browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || undefined });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const pageErrors: string[] = []; page.on("pageerror", error => pageErrors.push(error.message));
    let submitted: Record<string, unknown> | undefined;
    await page.route("**/api/checkouts", async route => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Payment initiation intercepted by the currency UI check." }) });
    });
    await page.goto(`${origin}/checkout/new?packageId=${pkg.id}`);
    const selector = page.getByRole("combobox", { name: "Display currency", exact: true });
    for (const code of ["USD", "NAD", "ZAR", "EUR", "GBP"]) {
      await selector.selectOption(code);
      await page.waitForFunction(currency => document.body.innerText.includes(`Displayed price: ${currency}`) && document.body.innerText.includes("You will be charged NAD 246.00"), code);
      assert.equal(await page.getByRole("button", { name: "Continue to secure payment" }).isDisabled(), true);
    }
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.includes("Displayed price: GBP"));
    await page.getByRole("textbox", { name: "Email address" }).fill("qa@example.test");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue to secure payment" }).click();
    await page.getByRole("alert").filter({ hasText: "Payment initiation intercepted" }).waitFor();
    assert.ok(submitted?.quoteId); assert.equal(submitted.packageId, pkg.id);
    assert.equal("amount" in submitted, false); assert.equal("currency" in submitted, false);
    await page.screenshot({ path: join(tmpdir(), "simplify-currency-checkout-desktop.png"), fullPage: true });
    await page.goto(`${origin}/plan/currency-ui-plan`);
    await page.waitForFunction(() => /GBP\s+11\.25/.test(document.querySelector("aside")?.textContent ?? ""));
    await page.getByRole("button", { name: "Add to cart", exact: true }).first().click();
    await page.waitForURL("**/cart");
    await page.waitForFunction(() => /GBP/.test(document.querySelector("article")?.textContent ?? "") && /11\.25/.test(document.querySelector("article")?.textContent ?? ""));
    await page.getByRole("combobox", { name: "Currency", exact: true }).selectOption("NAD");
    await page.waitForFunction(() => /NAD/.test(document.querySelector("article")?.textContent ?? "") && /246/.test(document.querySelector("article")?.textContent ?? ""));
    await page.evaluate(() => {
      const key = "sim-africa-cart-v1";
      const items = JSON.parse(localStorage.getItem(key) ?? "[]");
      for (const item of items) { item.unitPriceCents = 999999; item.currency = "USD"; }
      localStorage.setItem(key, JSON.stringify(items));
    });
    await page.reload();
    await page.waitForFunction(() => /NAD/.test(document.querySelector("article")?.textContent ?? "") && /246/.test(document.querySelector("article")?.textContent ?? ""));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/checkout/new?packageId=${pkg.id}`);
    await page.waitForFunction(() => document.body.innerText.includes("You will be charged NAD 246.00"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Mobile layout must not overflow");
    await page.screenshot({ path: join(tmpdir(), "simplify-currency-checkout-mobile.png"), fullPage: true });
    assert.deepEqual(pageErrors, []);
    const tokenFor = (id: string, email: string) => encode({ secret: "currency-ui-fixture-secret", token: { sub: id, email }, maxAge: 3600 });
    await context.addCookies([{ name: "next-auth.session-token", value: await tokenFor(account.id, account.email), url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.includes("Displayed price: NAD"));
    await selector.selectOption("EUR");
    await page.waitForFunction(() => document.body.innerText.includes("Displayed price: EUR"));
    const anotherDevice = await browser.newContext();
    await anotherDevice.addCookies([{ name: "next-auth.session-token", value: await tokenFor(account.id, account.email), url: origin, httpOnly: true, sameSite: "Lax" }]);
    const accountPage = await anotherDevice.newPage();
    await accountPage.goto(`${origin}/checkout/new?packageId=${pkg.id}`);
    await accountPage.waitForFunction(() => document.body.innerText.includes("Displayed price: EUR"));
    const otherDevice = await browser.newContext();
    await otherDevice.addCookies([{ name: "next-auth.session-token", value: await tokenFor(otherAccount.id, otherAccount.email), url: origin, httpOnly: true, sameSite: "Lax" }]);
    const otherPage = await otherDevice.newPage();
    await otherPage.goto(`${origin}/checkout/new?packageId=${pkg.id}`);
    await otherPage.waitForFunction(() => document.body.innerText.includes("Displayed price: GBP"));
    assert.equal((await anotherDevice.request.get(`${origin}/api/currency-preference`)).status(), 200);
    const crossOrigin = await anotherDevice.request.put(`${origin}/api/currency-preference`, { headers: { origin: "https://evil.example" }, data: { currency: "USD" } });
    assert.equal(crossOrigin.status(), 403);
    console.log("Currency UI passed: five currencies, fixed NAD charge, guest and account persistence across browsers, account isolation, required review, cart refresh and mobile layout. Payment initiation was intercepted.");
    console.log(`Screenshots: ${join(tmpdir(), "simplify-currency-checkout-desktop.png")} and ${join(tmpdir(), "simplify-currency-checkout-mobile.png")}`);
  } finally {
    await browser?.close();
    app.kill("SIGTERM");
    if (app.exitCode === null) await new Promise<void>(resolve => app.once("exit", () => resolve()));
    closeSync(output); await databaseServer.stop(); await sql.close(); rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
