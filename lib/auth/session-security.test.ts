import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { verifySessionToken } from "../auth";
import { safeReturnPath } from "./return-path";
import { verifyScopedAccessToken } from "../orders/access";
import { customerLoginReservation, withCustomerLoginReservation } from "../security/login-context";

test("admin sessions reject old formats, invalid timestamps, future issuance and signatures", async () => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "fixture-admin-secret";
  const sign = (payload: string) => `${payload}|${createHmac("sha256", "fixture-admin-secret").update(payload).digest("hex")}`;
  try {
    const now = Date.now();
    assert.ok(await verifySessionToken(sign(`v2|admin@example.test|${now}|2`)));
    for (const payload of [`admin@example.test|${now}`, `v2|admin@example.test|Infinity|2`, `v2|admin@example.test|NaN|2`, `v2|admin@example.test|${now + 120_000}|2`, `v2|admin@example.test|${now - 9 * 3_600_000}|2`, `v2|admin@example.test|${now}|-1`]) {
      assert.equal(await verifySessionToken(sign(payload)), null);
    }
    assert.equal(await verifySessionToken(sign(`v2|admin@example.test|${now}|2`) + "x"), null);
  } finally { if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previous; }
});

test("legacy guest links work only for resources whose access version is still zero", () => {
  const previous = process.env.ORDER_ACCESS_SECRET;
  process.env.ORDER_ACCESS_SECRET = "fixture-guest-secret";
  try {
    const payload = `v1|order|fixture-order|${Date.now()}|3600`;
    const token = `${payload}|${createHmac("sha256", "fixture-guest-secret").update(payload).digest("hex")}`;
    assert.equal(verifyScopedAccessToken(token, "order", "fixture-order", { accessVersion: 0 }), true);
    assert.equal(verifyScopedAccessToken(token, "order", "fixture-order", { accessVersion: 1 }), false);
  } finally { if (previous === undefined) delete process.env.ORDER_ACCESS_SECRET; else process.env.ORDER_ACCESS_SECRET = previous; }
});

test("recovery and sign-in return destinations remain local", () => {
  for (const value of ["https://evil.example", "//evil.example", "/%2fevil.example", "/\\evil.example", "/%0d%0aLocation:evil", "/bad%ZZ"]) assert.equal(safeReturnPath(value), "/account/esims");
  assert.equal(safeReturnPath("/orders/fixture?tab=installation"), "/orders/fixture?tab=installation");
});

test("login quota reservations stay isolated across concurrent requests", async () => {
  assert.equal(customerLoginReservation(), undefined);
  await Promise.all(["first", "second"].map(key => withCustomerLoginReservation([key], async () => {
    await new Promise(resolve => setTimeout(resolve, key === "first" ? 10 : 1));
    assert.deepEqual(customerLoginReservation(), [key]);
  })));
  assert.equal(customerLoginReservation(), undefined);
});
