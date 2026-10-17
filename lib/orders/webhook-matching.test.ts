import assert from "node:assert/strict";
import test from "node:test";

import { WebhookPayloadSchema } from "../airalo/schemas";
import {
  assertWebhookOrderIdentity,
  findOrderForWebhook,
  buildWebhookOrderClauses,
  resolveWebhookLocalOrderId,
  resolveWebhookRequestId,
} from "./webhook-matching";

test("unmatched supplier identifiers never fall back to a shared package", async () => {
  const queries: unknown[] = [];
  const tx = { esimOrder: { findMany: async (query: unknown) => { queries.push(query); return []; } } };
  const payload = WebhookPayloadSchema.parse({ data: { id: 123, package_id: "shared-package" } });
  const result = await findOrderForWebhook(tx as unknown as Parameters<typeof findOrderForWebhook>[0], payload);
  assert.equal(result.order, null);
  assert.equal(queries.length, 1);
  assert.deepEqual((queries[0] as { where: unknown }).where, { OR: [{ orderNumber: "123" }] });
});

test("conflicting supplier identifiers cannot select an arbitrary customer", async () => {
  const tx = { esimOrder: { findMany: async () => [{ id: "customer-a" }, { id: "customer-b" }] } };
  await assert.rejects(
    findOrderForWebhook(tx as unknown as Parameters<typeof findOrderForWebhook>[0], WebhookPayloadSchema.parse({
      data: { id: 123, description: "[simplify_order_id:customer-b]" },
    })),
    /different local purchases/,
  );
});

test("webhook identity rejects conflicting order, request, package, quantity and SIM fields", () => {
  const order = {
    id: "local-1", orderNumber: "123", requestId: "req-1", quantity: 1,
    profiles: [{ iccid: "sim-1" }], package: { airaloPackageId: "pkg-1" },
  } as Parameters<typeof assertWebhookOrderIdentity>[0];
  const valid = { order_id: "123", status: "completed", reference: "req-1", package_id: "pkg-1", iccid: "sim-1" };
  assert.doesNotThrow(() => assertWebhookOrderIdentity(order, valid));
  for (const conflict of [
    { order_id: "other" }, { reference: "other" }, { package_id: "other" },
    { description: "[simplify_order_id:other]" }, { iccid: "other" },
    { quantity: 2 }, { sims: [{ iccid: "sim-1" }, { iccid: "sim-2" }] },
  ]) {
    assert.throws(() => assertWebhookOrderIdentity(order, { ...valid, ...conflict }), /identity conflicts/);
  }
});

test("webhook matching prefers reference and falls back to request_id", () => {
  const withReference = {
    order_id: "A-ORDER-1",
    status: "completed",
    reference: "req-reference",
    request_id: "req-defensive",
  };

  assert.equal(resolveWebhookRequestId(withReference), "req-reference");
  assert.deepEqual(buildWebhookOrderClauses(withReference), [
    { orderNumber: "A-ORDER-1" },
    { requestId: "req-reference" },
  ]);

  const withRequestId = {
    order_id: "A-ORDER-2",
    status: "completed",
    request_id: "req-defensive",
  };

  assert.equal(resolveWebhookRequestId(withRequestId), "req-defensive");
  assert.deepEqual(buildWebhookOrderClauses(withRequestId), [
    { orderNumber: "A-ORDER-2" },
    { requestId: "req-defensive" },
  ]);

  const withCamelCaseRequestId = {
    order_id: "A-ORDER-3",
    status: "completed",
    requestId: "req-camel",
  };

  assert.equal(resolveWebhookRequestId(withCamelCaseRequestId), "req-camel");
  assert.deepEqual(buildWebhookOrderClauses(withCamelCaseRequestId), [
    { orderNumber: "A-ORDER-3" },
    { requestId: "req-camel" },
  ]);

  const withLocalOrderReference = {
    order_id: "A-ORDER-4",
    status: "completed",
    description: "2 x Test 1GB [simplify_order_id:local-order-1]",
  };

  assert.equal(resolveWebhookLocalOrderId(withLocalOrderReference), "local-order-1");
  assert.deepEqual(buildWebhookOrderClauses(withLocalOrderReference), [
    { orderNumber: "A-ORDER-4" },
    { id: "local-order-1" },
  ]);
});

test("Airalo webhook schema normalizes documented order response payloads", () => {
  const payload = WebhookPayloadSchema.parse({
    data: {
      id: 583747,
      code: "20250415-583747",
      package_id: "uki-mobile-15days-2gb",
      request_id: "req-async",
      description: "1 x UKI Mobile [simplify_order_id:order-local-1]",
      manual_installation: "<p>Manual</p>",
      sims: [
        {
          iccid: "8944465400003573253",
          matching_id: "YVTGM-5LZC6-PIC56-KFEZJ",
          qrcode: "LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ",
        },
      ],
    },
    meta: { message: "success" },
  });

  assert.equal(payload.event, "order.processed");
  assert.equal(payload.data.order_id, "583747");
  assert.equal(payload.data.status, "completed");
  assert.equal(payload.data.iccid, "8944465400003573253");
  assert.equal(resolveWebhookRequestId(payload.data), "req-async");
  assert.equal(resolveWebhookLocalOrderId(payload.data), "order-local-1");
  assert.deepEqual(buildWebhookOrderClauses(payload.data), [
    { orderNumber: "583747" },
    { id: "order-local-1" },
    { requestId: "req-async" },
  ]);
});
