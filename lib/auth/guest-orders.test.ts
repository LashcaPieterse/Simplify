import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";

import {
  claimGuestOrdersForVerifiedEmail,
  markUserEmailVerifiedAndClaimGuestOrders,
} from "./guest-orders";

function matchesEmail(value: string | null | undefined, filter: { equals: string }) {
  return value?.toLowerCase() === filter.equals.toLowerCase();
}

class FakeGuestOrderClaimDb {
  readonly users = [
    {
      id: "user-1",
      email: "Customer@Example.COM",
      emailVerifiedAt: null as Date | null,
    },
  ];

  readonly orders = [
    { id: "order-1", userId: null as string | null, customerEmail: "customer@example.com" },
    { id: "order-2", userId: null as string | null, customerEmail: "CUSTOMER@example.com" },
    { id: "order-owned", userId: "other-user", customerEmail: "customer@example.com" },
  ];

  readonly checkouts = [
    { id: "checkout-1", userId: null as string | null, customerEmail: "customer@example.com" },
    { id: "checkout-owned", userId: "other-user", customerEmail: "customer@example.com" },
  ];

  readonly payments = [
    {
      id: "payment-checkout",
      userId: null as string | null,
      checkoutId: "checkout-1",
      orderIds: [] as string[],
    },
    {
      id: "payment-order",
      userId: null as string | null,
      checkoutId: null as string | null,
      orderIds: ["order-1"],
    },
    {
      id: "payment-owned",
      userId: "other-user",
      checkoutId: "checkout-owned",
      orderIds: ["order-owned"],
    },
    {
      id: "payment-unowned-owned-relations",
      userId: null as string | null,
      checkoutId: "checkout-owned",
      orderIds: ["order-owned"],
    },
  ];

  readonly user = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.users.find((user) => user.id === where.id) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; email: { equals: string } };
      data: { emailVerifiedAt: Date };
    }) => {
      let count = 0;
      for (const user of this.users) {
        if (user.id !== where.id || !matchesEmail(user.email, where.email)) {
          continue;
        }

        user.emailVerifiedAt = data.emailVerifiedAt;
        count += 1;
      }
      return { count };
    },
  };

  readonly esimOrder = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { userId: null; customerEmail: { equals: string } };
      data: { userId: string };
    }) => {
      let count = 0;
      for (const order of this.orders) {
        if (order.userId !== where.userId || !matchesEmail(order.customerEmail, where.customerEmail)) {
          continue;
        }

        order.userId = data.userId;
        count += 1;
      }
      return { count };
    },
  };

  readonly checkoutSession = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { userId: null; customerEmail: { equals: string } };
      data: { userId: string };
    }) => {
      let count = 0;
      for (const checkout of this.checkouts) {
        if (checkout.userId !== where.userId || !matchesEmail(checkout.customerEmail, where.customerEmail)) {
          continue;
        }

        checkout.userId = data.userId;
        count += 1;
      }
      return { count };
    },
  };

  readonly paymentTransaction = {
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        userId: null;
        OR: Array<{
          checkout?: { is: { userId: string; customerEmail: { equals: string } } };
          orders?: { some: { userId: string; customerEmail: { equals: string } } };
        }>;
      };
      data: { userId: string };
    }) => {
      const checkoutFilter = where.OR[0]?.checkout?.is;
      const orderFilter = where.OR[1]?.orders?.some;
      let count = 0;

      for (const payment of this.payments) {
        if (payment.userId !== where.userId) {
          continue;
        }

        const checkout = payment.checkoutId
          ? this.checkouts.find((candidate) => candidate.id === payment.checkoutId)
          : null;
        const matchesCheckout = checkoutFilter
          ? checkout?.userId === checkoutFilter.userId &&
            matchesEmail(checkout.customerEmail, checkoutFilter.customerEmail)
          : false;
        const matchesOrder = orderFilter
          ? payment.orderIds.some((orderId) => {
              const order = this.orders.find((candidate) => candidate.id === orderId);
              return (
                order?.userId === orderFilter.userId &&
                matchesEmail(order.customerEmail, orderFilter.customerEmail)
              );
            })
          : false;

        if (!matchesCheckout && !matchesOrder) {
          continue;
        }

        payment.userId = data.userId;
        count += 1;
      }

      return { count };
    },
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

test("verified email claim attaches matching guest records without overwriting owners", async () => {
  const db = new FakeGuestOrderClaimDb();
  const result = await markUserEmailVerifiedAndClaimGuestOrders(
    db as unknown as PrismaClient,
    "user-1",
    "customer@example.com",
  );

  assert.deepEqual(result, { orders: 2, checkouts: 1, payments: 2 });
  assert.ok(db.users[0]?.emailVerifiedAt instanceof Date);
  assert.equal(db.orders.find((order) => order.id === "order-1")?.userId, "user-1");
  assert.equal(db.orders.find((order) => order.id === "order-2")?.userId, "user-1");
  assert.equal(db.orders.find((order) => order.id === "order-owned")?.userId, "other-user");
  assert.equal(db.checkouts.find((checkout) => checkout.id === "checkout-1")?.userId, "user-1");
  assert.equal(db.checkouts.find((checkout) => checkout.id === "checkout-owned")?.userId, "other-user");
  assert.equal(db.payments.find((payment) => payment.id === "payment-checkout")?.userId, "user-1");
  assert.equal(db.payments.find((payment) => payment.id === "payment-order")?.userId, "user-1");
  assert.equal(db.payments.find((payment) => payment.id === "payment-owned")?.userId, "other-user");
  assert.equal(
    db.payments.find((payment) => payment.id === "payment-unowned-owned-relations")?.userId,
    null,
  );

  const secondClaim = await claimGuestOrdersForVerifiedEmail(
    db as unknown as PrismaClient,
    "user-1",
    "CUSTOMER@example.com",
  );

  assert.deepEqual(secondClaim, { orders: 0, checkouts: 0, payments: 0 });
});

test("guest claim skips users whose email is not verified", async () => {
  const db = new FakeGuestOrderClaimDb();
  const result = await claimGuestOrdersForVerifiedEmail(
    db as unknown as PrismaClient,
    "user-1",
    "customer@example.com",
  );

  assert.deepEqual(result, {
    orders: 0,
    checkouts: 0,
    payments: 0,
    skipped: "user_not_verified",
  });
  assert.equal(db.orders.find((order) => order.id === "order-1")?.userId, null);
});
