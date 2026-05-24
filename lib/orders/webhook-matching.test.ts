import assert from "node:assert/strict";
import test from "node:test";

import { WebhookPayloadSchema } from "../airalo/schemas";
import {
  buildWebhookOrderClauses,
  resolveWebhookLocalOrderId,
  resolveWebhookRequestId,
} from "./webhook-matching";

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
