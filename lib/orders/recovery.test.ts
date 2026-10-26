import { fixtureOutbox } from "../testing/durable-fixture";
import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { OrderResponseSchema } from "../airalo/schemas";
import { applyRecoveredPurchase, recoverAiraloOrders, resolveRecoveryPurchase } from "./recovery";
import { authenticateRecoveryRequest } from "./recovery-auth";

const order = {
  id: "local-1", orderNumber: null, requestId: "async-request-1", status: "airalo_outcome_unknown",
  quantity: 1, profiles: [], package: { airaloPackageId: "pkg-1" }, checkout: null,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
} as unknown as Parameters<typeof applyRecoveredPurchase>[1];
const purchase = OrderResponseSchema.parse({ data: {
  id: 123, status: { slug: "completed" }, package_id: "pkg-1", quantity: 1,
  description: "1 x Plan [simplify_order_id:local-1]",
  sims: [{ iccid: "sim-1", matching_id: "activation" }],
} }).data;

test("recovery resolves exact local markers and never passes an async request ID to order lookup", async () => {
  const lookedUp: string[] = [];
  const result = await resolveRecoveryPurchase(order, {
    findOrdersByDescription: async (marker) => { assert.equal(marker, "[simplify_order_id:local-1]"); return [purchase]; },
    getOrderById: async (id) => { lookedUp.push(id); return purchase; },
  });
  assert.equal(result?.id, "123");
  assert.deepEqual(lookedUp, ["123"]);
});

test("recovery leaves missing, ambiguous, and changed supplier purchases unresolved", async () => {
  let lookups = 0;
  const supplier = { findOrdersByDescription: async () => [] as typeof purchase[], getOrderById: async () => { lookups += 1; return purchase; } };
  assert.equal(await resolveRecoveryPurchase(order, supplier), null);
  assert.equal(lookups, 0);
  await assert.rejects(resolveRecoveryPurchase(order, { ...supplier, findOrdersByDescription: async () => [purchase, purchase] }), /Multiple supplier purchases/);
  await assert.rejects(resolveRecoveryPurchase(order, {
    findOrdersByDescription: async () => [purchase],
    getOrderById: async () => ({ ...purchase, id: "other" }),
  }), /conflicting order ID/);
  await assert.rejects(resolveRecoveryPurchase(order, {
    findOrdersByDescription: async () => [purchase],
    getOrderById: async () => ({ ...purchase, description: "[simplify_order_id:local-2]" }),
  }), /exact local order marker/);
});

function transactionStub(owner = "local-1", claimCount = 1) {
  const writes: { table: string; input: unknown }[] = [];
  const write = (table: string) => async (input: unknown) => { writes.push({ table, input }); return {}; };
  const tx = {
    receiptDelivery: fixtureOutbox(),
    esimOrder: { findUnique: async () => ({ ...order, receiptSentAt: null }), updateMany: async (input: unknown) => { writes.push({ table: "order", input }); return { count: claimCount }; } },
    esimProfile: { upsert: async (input: unknown) => { writes.push({ table: "profile", input }); return { id: "profile-1", orderId: owner }; } },
    usageSnapshot: { create: write("usage") },
    esimInstallationPayload: { upsert: write("installation") },
    airaloOrderSnapshot: { create: write("snapshot") },
    esimOrderRecoveryAttempt: { create: write("attempt") },
  };
  return { writes, tx: tx as unknown as Prisma.TransactionClient };
}

test("recovery persists confirmed SIM details, installation and supplier evidence", async () => {
  const { tx, writes } = transactionStub();
  await applyRecoveredPurchase(tx, order, purchase);
  const orderWrite = writes.find((write) => write.table === "order")!.input as { data: unknown; where: unknown };
  assert.deepEqual(orderWrite.data, { orderNumber: "123", status: "completed" });
  assert.match(JSON.stringify(orderWrite.where), /airalo_outcome_unknown/);
  const profileWrite = writes.find((write) => write.table === "profile")!.input as { create: { activationCode: string }; update: Record<string, unknown> };
  assert.equal(profileWrite.create.activationCode, "activation");
  assert.equal("orderId" in profileWrite.update, false);
  assert.deepEqual(writes.map((write) => write.table), ["order", "profile", "installation", "snapshot", "attempt"]);
});

test("recovery refuses another customer's SIM and concurrent identity changes", async () => {
  const foreign = transactionStub("another-customer");
  await assert.rejects(applyRecoveredPurchase(foreign.tx, order, purchase), /already belongs/);
  assert.equal(foreign.writes.some((write) => write.table === "installation"), false);
  const race = transactionStub("local-1", 0);
  await assert.rejects(applyRecoveredPurchase(race.tx, order, purchase), /changed during recovery/);
  assert.deepEqual(race.writes.map((write) => write.table), ["order"]);
});

test("recovery refuses incomplete or multiple-SIM supplier fulfillment", async () => {
  for (const candidate of [
    { ...purchase, status: "pending" },
    { ...purchase, status: undefined },
    { ...purchase, sims: [] },
    { ...purchase, sims: [{ iccid: "sim-1" }, { iccid: "sim-2" }] },
  ]) {
    const { tx, writes } = transactionStub();
    await assert.rejects(applyRecoveredPurchase(tx, order, candidate));
    assert.equal(writes.length, 0);
  }
});

test("unknown purchases stay blocked and enter the manual review queue when search is empty", async () => {
  const { tx, writes } = transactionStub();
  let selection: unknown;
  const db = {
    esimOrder: { findMany: async (input: unknown) => { selection = input; return [order]; } },
    $transaction: async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaClient;
  const summary = await recoverAiraloOrders({ prisma: db, airalo: {
    findOrdersByDescription: async () => [],
    getOrderById: async () => { throw new Error("Must not lookup the async request ID"); },
  } });
  assert.deepEqual(summary, { checked: 1, recovered: 0, unresolved: 1 });
  assert.match(JSON.stringify(selection), /airalo_outcome_unknown/);
  assert.match(JSON.stringify(selection), /airalo_submitting/);
  assert.match(JSON.stringify(selection), /recoveryAttempts/);
  const orderUpdate = writes.find((write) => write.table === "order")!.input as { data: Record<string, unknown> };
  assert.deepEqual(Object.keys(orderUpdate.data), ["updatedAt"]);
});

test("recovery endpoint authentication fails closed without a matching header secret", () => {
  assert.equal(authenticateRecoveryRequest(new Headers(), undefined), false);
  assert.equal(authenticateRecoveryRequest(new Headers(), "secret"), false);
  assert.equal(authenticateRecoveryRequest(new Headers({ "x-airalo-sync-key": "wrong" }), "secret"), false);
  assert.equal(authenticateRecoveryRequest(new Headers({ "x-airalo-sync-key": "secret" }), "secret"), true);
});

test("top-up recovery confirms the original SIM without creating or reassigning a profile", async () => {
  const { tx, writes } = transactionStub();
  tx.esimProfile.findUnique = (async () => ({ orderId: "original-order" })) as unknown as typeof tx.esimProfile.findUnique;
  const topUpOrder = { ...order, checkout: { intent: "top-up", topUpForIccid: "sim-1", topUpForOrderId: "original-order" } } as typeof order;
  const topUpPurchase = { ...purchase, type: "topup", description: "Topup (sim-1) [simplify_order_id:local-1]" };
  await applyRecoveredPurchase(tx, topUpOrder, topUpPurchase);
  assert.deepEqual(writes.map((write) => write.table), ["order", "snapshot", "attempt"]);

  const foreign = transactionStub();
  foreign.tx.esimProfile.findUnique = (async () => ({ orderId: "another-customer" })) as unknown as typeof tx.esimProfile.findUnique;
  await assert.rejects(applyRecoveredPurchase(foreign.tx, topUpOrder, topUpPurchase), /ownership conflicts/);
  assert.equal(foreign.writes.length, 0);
});
