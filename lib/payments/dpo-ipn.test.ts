import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleDpoIpn, verifyDpoIpnSignature } from "./dpo-ipn";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function buildDeps(calls: string[]) {
  return {
    findPaymentTransaction: async (token: string) => {
      calls.push(`find:${token}`);
      return { id: "payment-1", checkoutId: "checkout-1" };
    },
    recordPaymentEvent: async (transactionId: string, eventType: string) => {
      calls.push(`record:${transactionId}:${eventType}`);
    },
    updatePaymentStatus: async (transactionId: string, status: string) => {
      calls.push(`update:${transactionId}:${status}`);
    },
    finaliseOrderFromCheckout: async (
      checkoutId: string,
      options: { forceStatus: string },
    ) => {
      calls.push(`finalise:${checkoutId}:${options.forceStatus}`);
      return { orderId: "order-1" };
    },
    setCheckoutStatus: async (checkoutId: string, status: string) => {
      calls.push(`checkout:${checkoutId}:${status}`);
    },
  };
}

test("verifyDpoIpnSignature fails closed when the production secret is missing", () => {
  assert.equal(
    verifyDpoIpnSignature({
      body: "{}",
      signature: null,
      secret: null,
      allowMissingSecret: false,
    }),
    false,
  );
  assert.equal(
    verifyDpoIpnSignature({
      body: "{}",
      signature: null,
      secret: null,
      allowMissingSecret: true,
    }),
    true,
  );
});

test("handleDpoIpn rejects unsigned production payloads before mutation", async () => {
  const calls: string[] = [];
  const result = await handleDpoIpn({
    rawBody: JSON.stringify({ TransactionToken: "token-1", Status: "approved" }),
    signature: null,
    contentType: "application/json",
    secret: null,
    nodeEnv: "production",
    deps: buildDeps(calls),
  });

  assert.equal(result.status, 401);
  assert.deepEqual(calls, []);
});

test("handleDpoIpn records and finalises approved signed payments", async () => {
  const calls: string[] = [];
  const secret = "dpo-secret";
  const body = JSON.stringify({
    TransactionToken: "token-1",
    Status: "approved",
  });

  const result = await handleDpoIpn({
    rawBody: body,
    signature: sign(body, secret),
    contentType: "application/json",
    secret,
    nodeEnv: "production",
    deps: buildDeps(calls),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    "find:token-1",
    "record:payment-1:ipn",
    "update:payment-1:approved",
    "finalise:checkout-1:approved",
  ]);
});

test("handleDpoIpn marks failed signed payments as failed checkouts", async () => {
  const calls: string[] = [];
  const secret = "dpo-secret";
  const body = JSON.stringify({
    TransactionToken: "token-1",
    Status: "failed",
  });

  const result = await handleDpoIpn({
    rawBody: body,
    signature: sign(body, secret),
    contentType: "application/json",
    secret,
    nodeEnv: "production",
    deps: buildDeps(calls),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    "find:token-1",
    "record:payment-1:ipn",
    "update:payment-1:failed",
    "checkout:checkout-1:failed",
  ]);
});

