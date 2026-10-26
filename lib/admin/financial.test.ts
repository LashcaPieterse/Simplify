import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { parseOperationAmount, requestFingerprint, requireFeature, type OperationInput } from "./financial";
import { DpoClient } from "../payments/dpo";

test("financial amounts reject rounding, exponents, negatives and unsupported values", () => {
  assert.equal(parseOperationAmount("12.34"), 1234);
  for (const amount of ["0", "-1", "1.001", "1e2", "NaN", "Infinity", "", "100000000000"]) assert.throws(() => parseOperationAmount(amount));
});
test("operation keys bind immutable intent while financial submissions default disabled", () => {
  const input: OperationInput = { kind: "refund", targetId: "payment", expectedVersion: "v1", reason: "Independent evidence", confirmation: true, idempotencyKey: randomUUID(), amount: "10" };
  assert.equal(requestFingerprint(input), requestFingerprint({ ...input, idempotencyKey: randomUUID() }));
  assert.notEqual(requestFingerprint(input), requestFingerprint({ ...input, amount: "20" }));
  const previous = process.env.ADMIN_REFUNDS_ENABLED; delete process.env.ADMIN_REFUNDS_ENABLED;
  try { assert.throws(() => requireFeature("refund"), /disabled/); assert.doesNotThrow(() => requireFeature("resolve_refund")); }
  finally { if (previous !== undefined) process.env.ADMIN_REFUNDS_ENABLED = previous; }
});
test("DPO mutations escape XML, preserve exact refund cents, and never automatically retry", async t => {
  const bodies: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => { bodies.push(String(init.body)); return new Response("<API3G><Result>000</Result></API3G>"); });
  const client = new DpoClient({ companyToken: "fixture-company", serviceUrl: "https://gateway.example.test/API/v6", paymentUrl: "https://gateway.example.test", serviceType: "fixture-service" });
  assert.equal((await client.mutateTransaction("capture", "fixture-token")).accepted, true);
  assert.match(bodies[0], /<Request>chargeTokenAuth<\/Request>/);
  await client.mutateTransaction("refund", "fixture-token", { amountCents: 1234, reason: "Evidence <checked> & confirmed", reference: "refund-fixture" });
  assert.match(bodies[1], /<refundAmount>12\.34<\/refundAmount>/);
  assert.match(bodies[1], /Evidence &lt;checked&gt; &amp; confirmed/);
  assert.match(bodies[1], /<refundRef>refund-fixture<\/refundRef>/);
  await client.mutateTransaction("cancel", "fixture-token"); assert.match(bodies[2], /<Request>cancelToken<\/Request>/);
  t.mock.method(globalThis, "fetch", async () => { bodies.push("timeout"); throw new Error("response lost"); });
  await assert.rejects(client.mutateTransaction("refund", "fixture-token", { amountCents: 100 }), /response lost/);
  assert.equal(bodies.filter(body => body === "timeout").length, 1);
});
