import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWebhookOrderClauses,
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
});
