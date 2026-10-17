import assert from "node:assert/strict";
import test from "node:test";

import { findProductionIncidents, firstPaymentApproval, runProductionAlerts, type AlertStore, type MonitorSnapshot } from "./alerts";

const now = new Date("2026-10-17T20:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);
function healthy(): MonitorSnapshot {
  return { activatedAt: ago(60), checkouts: [], supplierOrders: [],
    recovery: { active: true, lastStart: ago(2), lastStatus: "succeeded", lastSuccess: ago(2), httpStatus: 200, httpError: false, responseValid: true },
    monitor: { active: true, lastSuccess: ago(2) } };
}
function checkout() {
  return { id: "checkout-1", intent: "purchase", paidAt: ago(11), orderId: null as string | null,
    orderStatus: null as string | null, supplierOrderId: null as string | null, deliveryReady: false, receiptSent: false };
}

test("repeated verification cannot postpone the first approval's delivery deadline", () => {
  const paidAt = firstPaymentApproval(JSON.stringify([
    { status: "approved", at: ago(1).toISOString() },
    { status: "pending", at: ago(30).toISOString() },
    { status: "approved", at: ago(11).toISOString() },
    { status: "approved", at: "invalid" }, null,
  ]), now);
  assert.equal(paidAt.toISOString(), ago(11).toISOString());
  const snapshot = healthy();
  snapshot.checkouts = [{ ...checkout(), paidAt }];
  assert.equal(findProductionIncidents(snapshot, now).length, 1);
  for (const invalid of [null, "broken", "{}", "[]", '[{"status":"pending"}]']) {
    assert.equal(firstPaymentApproval(invalid, now), now);
  }
});

test("healthy recovery and deliveries produce no production alerts", () => {
  const snapshot = healthy();
  snapshot.checkouts = [{ ...checkout(), orderId: "order-1", orderStatus: "completed", supplierOrderId: "123", deliveryReady: true, receiptSent: true }];
  assert.deepEqual(findProductionIncidents(snapshot, now), []);
});

test("paid checkouts alert only after the payment grace period", () => {
  const snapshot = healthy();
  snapshot.checkouts = [checkout(), { ...checkout(), id: "newly-paid", paidAt: ago(9) }];
  assert.deepEqual(findProductionIncidents(snapshot, now).map(i => i.key), ["delivery:checkout-1"]);
});

test("missing receipt and completed order without installation credentials alert", () => {
  for (const deliveryReady of [true, false]) {
    const snapshot = healthy();
    snapshot.checkouts = [{ ...checkout(), orderId: "order-1", orderStatus: "completed", supplierOrderId: "123", deliveryReady }];
    const incidents = findProductionIncidents(snapshot, now);
    assert.equal(incidents.length, 1);
    assert.match(incidents[0].title, deliveryReady ? /receipt has not been sent/ : /awaiting fulfilment/);
  }
});

test("completed top-ups do not require a new profile or installation email", () => {
  const snapshot = healthy();
  snapshot.checkouts = [{ ...checkout(), intent: "top-up", orderId: "topup-1", orderStatus: "completed", supplierOrderId: "123" }];
  assert.deepEqual(findProductionIncidents(snapshot, now), []);
});

test("supplier ambiguity is one manual-review incident rather than duplicate delivery alerts", () => {
  const snapshot = healthy();
  snapshot.checkouts = [{ ...checkout(), orderId: "order-1", orderStatus: "airalo_outcome_unknown" }];
  snapshot.supplierOrders = [{ id: "order-1", status: "airalo_outcome_unknown", createdAt: ago(11), deliveryReady: false, unresolved: true }];
  const incidents = findProductionIncidents(snapshot, now);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].key, "supplier:order-1");
  assert.match(incidents[0].detail, /Do not resubmit/);
});

test("recent supplier submissions get time to complete; overdue unresolved submissions alert", () => {
  const snapshot = healthy();
  snapshot.supplierOrders = [
    { id: "new", status: "airalo_submitting", createdAt: ago(3), deliveryReady: false, unresolved: false },
    { id: "stalled", status: "airalo_submitting", createdAt: ago(11), deliveryReady: false, unresolved: false },
    { id: "unresolved", status: "pending", createdAt: ago(46), deliveryReady: false, unresolved: true },
  ];
  assert.deepEqual(findProductionIncidents(snapshot, now).map(i => i.key), ["supplier:stalled", "supplier:unresolved"]);
});

test("recovery alerts for disabled jobs, missed heartbeats, HTTP errors, invalid responses, and stalled runs", () => {
  for (const patch of [
    { active: false }, { active: null }, { lastSuccess: ago(16) }, { httpStatus: 401 },
    { httpError: true }, { responseValid: false }, { lastStatus: "failed" },
    { lastStatus: "running", lastStart: ago(7) },
  ]) {
    const snapshot = healthy();
    Object.assign(snapshot.recovery, patch);
    assert.equal(findProductionIncidents(snapshot, now).length, 1);
  }
});

test("normal in-progress recovery is healthy, and initial monitor activation has a grace period", () => {
  const snapshot = healthy();
  snapshot.recovery.lastStatus = "running";
  snapshot.activatedAt = ago(1);
  snapshot.monitor.lastSuccess = null;
  assert.deepEqual(findProductionIncidents(snapshot, now), []);
  snapshot.activatedAt = ago(16);
  assert.equal(findProductionIncidents(snapshot, now)[0]?.key, "monitor:stopped");
  snapshot.monitor.active = false;
  assert.equal(findProductionIncidents(snapshot, now)[0]?.key, "monitor:stopped");
});

test("notification leases suppress duplicate sends and preserve immutable retry payloads", async () => {
  const snapshot = healthy(); snapshot.checkouts = [checkout()];
  const deliveries: Array<{ key: string; id: string | null }> = [];
  let claimed = false;
  const frozenPayload = { to: "owner@example.com", subject: "Frozen incident", text: "Original body" };
  const store: AlertStore = {
    snapshot: async () => snapshot, sync: async () => {},
    claim: async () => claimed ? null : (claimed = true, { notificationKey: "stable-key", payload: frozenPayload }),
    finish: async (key, _notification, id) => { deliveries.push({ key, id }); },
  };
  let sends = 0;
  const options = { store, recipient: "owner@example.com", sender: "alerts@example.com", now,
    send: async (payload: Parameters<Parameters<typeof runProductionAlerts>[0]["send"]>[0]) => {
      sends++; assert.equal(payload.text, "Original body"); assert.equal(payload.idempotencyKey, "stable-key");
      return { skipped: false, id: "email-1" };
    } };
  assert.equal((await runProductionAlerts(options)).sent, 1);
  assert.equal((await runProductionAlerts(options)).sent, 0);
  assert.equal(sends, 1);
  assert.deepEqual(deliveries, [{ key: "delivery:checkout-1", id: "email-1" }]);
});

test("skipped and failed email sends are not marked delivered; a healthy scan resolves old incidents", async () => {
  for (const send of [async () => ({ skipped: true, id: null }), async () => { throw new Error("Provider unavailable"); }]) {
    const snapshot = healthy(); snapshot.checkouts = [checkout()];
    const store: AlertStore = {
      snapshot: async () => snapshot, sync: async () => {},
      claim: async (_key, payload) => ({ notificationKey: "retry-key", payload }),
      finish: async (_key, _notification, id) => { assert.equal(id, null); },
    };
    const result = await runProductionAlerts({ store, send, recipient: "owner@example.com", sender: "alerts@example.com", now });
    assert.equal(result.ok, false); assert.equal(result.failed, 1);
  }
  let resolved = false;
  await runProductionAlerts({ store: {
    snapshot: async () => healthy(), sync: async incidents => { resolved = incidents.length === 0; },
    claim: async () => { throw new Error("No incident should be claimed"); }, finish: async () => {},
  }, send: async () => { throw new Error("No email expected"); }, recipient: "owner@example.com", sender: "alerts@example.com", now });
  assert.equal(resolved, true);
});

test("each monitor run limits notifications even when many incidents are active", async () => {
  const snapshot = healthy(); snapshot.checkouts = Array.from({ length: 9 }, (_, n) => ({ ...checkout(), id: `checkout-${n}` }));
  const result = await runProductionAlerts({ store: {
    snapshot: async () => snapshot, sync: async () => {}, claim: async (_key, payload) => ({ notificationKey: "key", payload }), finish: async () => {},
  }, send: async () => ({ skipped: false, id: "email" }), recipient: "owner@example.com", sender: "alerts@example.com", now });
  assert.equal(result.sent, 5); assert.equal(result.activeIncidents, 9);
});
