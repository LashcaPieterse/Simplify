import assert from "node:assert/strict";
import test from "node:test";

import {
  DPO_PUSH_EVENT_TYPE,
  DPO_PUSH_OK_XML,
  handleDpoPushPayment,
} from "./dpo-ipn";

function pushXml(overrides: Record<string, string> = {}): string {
  const fields = {
    Result: "000",
    ResultExplanation: "Transaction paid",
    TransactionToken: "token-1",
    TransactionRef: "checkout-1",
    TransactionCurrency: "USD",
    TransactionAmount: "950.00",
    TransactionApproval: "APPROVED-1",
    FraudAlert: "000",
    AccRef: "ACC-1",
    ...overrides,
  };

  const body = Object.entries(fields)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?><API3G>${body}</API3G>`;
}

function buildDeps(options: {
  knownPayment?: boolean;
  verifyThrows?: boolean;
} = {}) {
  const calls: string[] = [];
  const events: unknown[] = [];
  let createdOrders = 0;
  let finalized = false;
  const payment =
    options.knownPayment === false
      ? null
      : {
          id: "payment-1",
          checkoutId: "checkout-1",
          amountCents: 95000,
          currency: "USD",
        };

  return {
    calls,
    events,
    get createdOrders() {
      return createdOrders;
    },
    deps: {
      findPaymentTransactionByToken: async (token: string) => {
        calls.push(`find-token:${token}`);
        return token === "token-1" ? payment : null;
      },
      findPaymentTransactionByReference: async (reference: string) => {
        calls.push(`find-reference:${reference}`);
        return reference === "checkout-1" ? payment : null;
      },
      recordPaymentEvent: async (
        transactionId: string,
        eventType: string,
        payload: unknown,
      ) => {
        calls.push(`record:${transactionId}:${eventType}`);
        events.push(payload);
      },
      updatePaymentStatus: async (transactionId: string, status: string) => {
        calls.push(`update:${transactionId}:${status}`);
      },
      verifyPaymentTransaction: async (transactionId: string) => {
        calls.push(`verify:${transactionId}`);
        if (options.verifyThrows) {
          throw new Error("DPO verify failed");
        }
        if (!finalized) {
          createdOrders += 1;
          finalized = true;
        }
        return { paymentStatus: "approved", orderId: "order-1" };
      },
      setCheckoutStatus: async (checkoutId: string, status: string) => {
        calls.push(`checkout:${checkoutId}:${status}`);
      },
    },
  };
}

test("handleDpoPushPayment records and verifies documented successful XML pushes", async () => {
  const state = buildDeps();

  const result = await handleDpoPushPayment({
    rawBody: pushXml(),
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body, DPO_PUSH_OK_XML);
  assert.deepEqual(state.calls, [
    "find-token:token-1",
    `record:payment-1:${DPO_PUSH_EVENT_TYPE}`,
    "verify:payment-1",
  ]);
  assert.equal(state.events.length, 1);
  assert.equal(state.createdOrders, 1);
});

test("handleDpoPushPayment processes duplicate pushes without duplicate fulfilment", async () => {
  const state = buildDeps();

  const first = await handleDpoPushPayment({
    rawBody: pushXml(),
    contentType: "text/xml",
    deps: state.deps,
  });
  const second = await handleDpoPushPayment({
    rawBody: pushXml(),
    contentType: "text/xml",
    deps: state.deps,
  });

  assert.equal(first.body, DPO_PUSH_OK_XML);
  assert.equal(second.body, DPO_PUSH_OK_XML);
  assert.equal(state.createdOrders, 1);
  assert.equal(
    state.calls.filter((call) => call === "verify:payment-1").length,
    2,
  );
});

test("handleDpoPushPayment rejects unknown transaction references before mutation", async () => {
  const state = buildDeps({ knownPayment: false });

  const result = await handleDpoPushPayment({
    rawBody: pushXml(),
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.status, 404);
  assert.match(result.body, /payment_transaction_not_found/);
  assert.deepEqual(state.calls, [
    "find-token:token-1",
    "find-reference:checkout-1",
  ]);
});

test("handleDpoPushPayment records amount mismatches but does not fulfil", async () => {
  const state = buildDeps();

  const result = await handleDpoPushPayment({
    rawBody: pushXml({ TransactionAmount: "951.00" }),
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.body, DPO_PUSH_OK_XML);
  assert.deepEqual(state.calls, [
    "find-token:token-1",
    `record:payment-1:${DPO_PUSH_EVENT_TYPE}`,
    "update:payment-1:verification_mismatch",
  ]);
  assert.equal(state.createdOrders, 0);
});

test("handleDpoPushPayment records currency mismatches but does not fulfil", async () => {
  const state = buildDeps();

  const result = await handleDpoPushPayment({
    rawBody: pushXml({ TransactionCurrency: "KES" }),
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.body, DPO_PUSH_OK_XML);
  assert.deepEqual(state.calls, [
    "find-token:token-1",
    `record:payment-1:${DPO_PUSH_EVENT_TYPE}`,
    "update:payment-1:verification_mismatch",
  ]);
  assert.equal(state.createdOrders, 0);
});

test("handleDpoPushPayment rejects malformed XML before mutation", async () => {
  const state = buildDeps();

  const result = await handleDpoPushPayment({
    rawBody: "{ not xml }",
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.status, 400);
  assert.match(result.body, /invalid_xml/);
  assert.deepEqual(state.calls, []);
});

test("handleDpoPushPayment records non-success pushes without fulfilment", async () => {
  const state = buildDeps();

  const result = await handleDpoPushPayment({
    rawBody: pushXml({
      Result: "901",
      ResultExplanation: "Transaction failed",
    }),
    contentType: "application/xml",
    deps: state.deps,
  });

  assert.equal(result.body, DPO_PUSH_OK_XML);
  assert.deepEqual(state.calls, [
    "find-token:token-1",
    `record:payment-1:${DPO_PUSH_EVENT_TYPE}`,
    "update:payment-1:failed",
    "checkout:checkout-1:failed",
  ]);
  assert.equal(state.createdOrders, 0);
});
