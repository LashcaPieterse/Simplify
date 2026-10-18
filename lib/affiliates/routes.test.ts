import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as adminPost } from "../../app/api/admin/affiliates/route";
import { GET as exportPayouts } from "../../app/api/admin/affiliates/payouts/export/route";
import { POST as referralPost, DELETE as forgetReferral, GET as referralGet } from "../../app/api/affiliates/referral/route";

test("affiliate HTTP boundaries require admin auth, reject cross-origin changes, and honor referral consent", async () => {
  const overrides = { NEXT_PUBLIC_APP_URL: "https://sim.example.test", AFFILIATE_PROGRAM_ENABLED: "false", ADMIN_SESSION_SECRET: "sandbox-admin-session-secret", ADMIN_EMAIL: "admin@example.test", ADMIN_ALLOWED_EMAILS: "admin@example.test" };
  const old = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  const make = (path: string, init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => new NextRequest(`https://sim.example.test${path}`, init);
  try {
    assert.equal((await adminPost(make("/api/admin/affiliates", { method: "POST" }))).status, 401);
    assert.equal((await exportPayouts(make("/api/admin/affiliates/payouts/export"))).status, 401);
    const payload = `admin@example.test|${Date.now()}`;
    const token = `${payload}|${createHmac("sha256", overrides.ADMIN_SESSION_SECRET).update(payload).digest("hex")}`;
    assert.equal((await adminPost(make("/api/admin/affiliates", { method: "POST", headers: { cookie: `simplify-admin-session=${encodeURIComponent(token)}`, origin: "https://evil.example" } }))).status, 403);
    assert.equal((await forgetReferral(make("/api/affiliates/referral", { method: "DELETE", headers: { origin: "https://evil.example" } }))).status, 403);
    const forgotten = await forgetReferral(make("/api/affiliates/referral", { method: "DELETE", headers: { origin: overrides.NEXT_PUBLIC_APP_URL } }));
    assert.match(forgotten.headers.get("set-cookie")!, /Max-Age=0/);
    const declined = await referralPost(make("/api/affiliates/referral", { method: "POST", headers: { origin: overrides.NEXT_PUBLIC_APP_URL, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ remember: "no", code: "ABCDEF123456", to: "//evil.example" }) }));
    assert.equal(declined.status, 303); assert.equal(declined.headers.get("location"), "https://sim.example.test/destinations");
    assert.match(declined.headers.get("set-cookie")!, /Max-Age=0/);
    const inactive = await referralPost(make("/api/affiliates/referral", { method: "POST", headers: { origin: overrides.NEXT_PUBLIC_APP_URL }, body: new URLSearchParams({ remember: "yes", code: "ABCDEF123456", to: "/" }) }));
    assert.equal(inactive.status, 422); assert.equal(inactive.headers.get("set-cookie"), null);
    const disabled = await referralGet(make("/api/affiliates/referral"));
    assert.deepEqual(await disabled.json(), { enabled: false, guide: null });
    assert.equal(disabled.headers.get("cache-control"), "private, no-store");
  } finally { for (const key of Object.keys(overrides)) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } }
});
