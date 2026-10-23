import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

test("browser: recovery and top-up outcomes never imply premature completion", { timeout: 120_000 }, async t => {
  const baseUrl = "http://127.0.0.1:3109";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3109", "--hostname", "127.0.0.1"], {
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture?connect_timeout=1",
      NEXT_PUBLIC_APP_URL: baseUrl, NEXTAUTH_URL: baseUrl, NEXTAUTH_SECRET: "browser-fixture-secret", ORDER_ACCESS_SECRET: "browser-fixture-access",
      RESEND_API_KEY: "fixture-no-network", EMAIL_FROM: "recovery@example.test", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "",
      APPLE_CLIENT_ID: "", APPLE_CLIENT_SECRET: "", AIRALO_CLIENT_ID: "", AIRALO_CLIENT_SECRET: "", PURCHASE_LIFECYCLE_ENABLED: "false", RECEIPT_OUTBOX_ENABLED: "false" },
    stdio: "ignore",
  });
  t.after(() => { server.kill("SIGTERM"); });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${baseUrl}/auth/recover`)).ok; } catch { /* Wait for the local test server. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Production fixture server must start.");
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(chrome) ? chrome : undefined) });
  t.after(() => browser.close());

  for (const outcome of ["pending", "declined", "complete"] as const) {
    await t.test(`top-up ${outcome}`, async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      let triggers = 0;
      let statuses = 0;
      await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/reconcile")) triggers++;
        if (path.endsWith("/status")) statuses++;
        const completed = outcome === "complete" && statuses > 1;
        const data = path.endsWith("/status") || path.endsWith("/reconcile")
          ? { checkoutId: "fixture", status: "pending", paymentStatus: completed ? "approved" : outcome === "declined" ? "declined" : "pending",
              orderId: completed ? "topup-order" : null, redirectOrderId: "original-order", isComplete: completed }
          : path === "/api/auth/session" ? null : { currency: "USD", needsAdoption: false };
        await route.fulfill({ json: data });
      });
      await page.route("**/orders/original-order", route => route.fulfill({ contentType: "text/html", body: "<main><h1>Original eSIM</h1></main>" }));
      const reconciliation = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/reconcile"));
      await page.goto(`${baseUrl}/checkout/fixture/return`);
      await reconciliation;
      if (outcome === "pending") {
        await page.waitForFunction(() => document.body.textContent?.includes("Current status: pending"));
        assert.match(page.url(), /\/checkout\/fixture\/return$/);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("sim-africa-purchase-fixture")), null);
      } else if (outcome === "declined") {
        await page.waitForURL("**/checkout/fixture/failed");
        assert.equal(await page.evaluate(() => sessionStorage.getItem("sim-africa-purchase-fixture")), null);
      } else {
        await page.waitForURL("**/orders/original-order");
        assert.equal(await page.evaluate(() => sessionStorage.getItem("sim-africa-purchase-fixture")), "1");
      }
      assert.equal(triggers, 1, "Only one explicit browser-return reconciliation request is sent.");
      await page.close();
    });
  }
  await t.test("email recovery reports a link request without exposing purchases", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let emails = 0;
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/signin/email") emails++;
      await route.fulfill({ json: path.endsWith("/providers") ? { email: { id: "email", name: "Email", type: "email", signinUrl: `${baseUrl}/api/auth/signin/email`, callbackUrl: `${baseUrl}/api/auth/callback/email` } }
        : path.endsWith("/csrf") ? { csrfToken: "fixture" } : path === "/api/auth/signin/email" ? { url: `${baseUrl}/auth/recover` } : path.endsWith("/session") ? null : { currency: "USD" } });
    });
    await page.goto(`${baseUrl}/auth/recover?returnTo=%2Faccount%2Fesims`);
    await page.getByLabel("Account email").fill("victim@example.test");
    await page.getByRole("button", { name: "Verify my email" }).click();
    await page.getByRole("status").filter({ hasText: "Check your inbox" }).waitFor();
    assert.equal(emails, 1);
    assert.match(page.url(), /\/auth\/recover/);
    await page.close();
  });
});
