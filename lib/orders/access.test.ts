import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessOwnerScopedRecord,
  canStartTopUpCheckout,
  createOrderAccessLink,
  createScopedAccessToken,
  hasScopedAccessFromCookieHeader,
  scopedAccessCookieName,
  verifyScopedAccessToken,
} from "./access";

function withAccessSecret<T>(fn: () => T): T {
  const previous = process.env.ORDER_ACCESS_SECRET;
  process.env.ORDER_ACCESS_SECRET = "test-order-access-secret";
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.ORDER_ACCESS_SECRET;
    } else {
      process.env.ORDER_ACCESS_SECRET = previous;
    }
  }
}

test("scoped order access tokens validate scope, id, signature, and expiry", () => {
  withAccessSecret(() => {
    const issuedAt = Date.now();
    const token = createScopedAccessToken("order", "order-1", {
      issuedAt,
      ttlSeconds: 60,
    });

    assert.equal(verifyScopedAccessToken(token, "order", "order-1"), true);
    assert.equal(verifyScopedAccessToken(token, "checkout", "order-1"), false);
    assert.equal(verifyScopedAccessToken(token, "order", "order-2"), false);
    assert.equal(
      verifyScopedAccessToken(`${token}tampered`, "order", "order-1"),
      false,
    );
    assert.equal(
      verifyScopedAccessToken(token, "order", "order-1", {
        now: issuedAt + 61_000,
      }),
      false,
    );
  });
});

test("owner-scoped records allow owners and scoped token holders only", () => {
  assert.equal(
    canAccessOwnerScopedRecord(
      { userId: "user-1" },
      { user: { id: "user-1" } },
      false,
    ),
    true,
  );
  assert.equal(
    canAccessOwnerScopedRecord(
      { userId: "user-1" },
      { user: { id: "user-2" } },
      false,
    ),
    false,
  );
  assert.equal(canAccessOwnerScopedRecord({ userId: null }, null, true), true);
});

test("top-up checkout start requires an authenticated owner session", () => {
  assert.equal(
    canStartTopUpCheckout({ userId: "user-1" }, { user: { id: "user-1" } }),
    true,
  );
  assert.equal(
    canStartTopUpCheckout({ userId: "user-1" }, { user: { id: "user-2" } }),
    false,
  );
  assert.equal(canStartTopUpCheckout({ userId: "user-1" }, null), false);
});

test("cookie-header helper validates the scoped cookie value", () => {
  withAccessSecret(() => {
    const token = createScopedAccessToken("checkout", "checkout-1");
    const name = scopedAccessCookieName("checkout", "checkout-1");
    const header = `other=value; ${name}=${encodeURIComponent(token)}`;

    assert.equal(
      hasScopedAccessFromCookieHeader(header, "checkout", "checkout-1"),
      true,
    );
    assert.equal(
      hasScopedAccessFromCookieHeader(header, "checkout", "checkout-2"),
      false,
    );
  });
});

test("signed order access links carry a valid scoped token", () => {
  withAccessSecret(() => {
    const issuedAt = Date.now();
    const link = createOrderAccessLink("order-1", "https://simplify.example", {
      issuedAt,
      ttlSeconds: 60,
    });
    const url = new URL(link);
    const token = url.searchParams.get("token");

    assert.equal(url.pathname, "/orders/order-1/access");
    assert.equal(
      verifyScopedAccessToken(token, "order", "order-1", {
        now: issuedAt + 30_000,
      }),
      true,
    );
    assert.equal(verifyScopedAccessToken(token, "order", "order-2"), false);
  });
});
