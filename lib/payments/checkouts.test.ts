import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";
import type { AiraloClient, CreateOrderPayload } from "../airalo/client";
import { OrderResponseSchema, type OrderResponse } from "../airalo/schemas";
import type { CreateOrderOptions } from "../orders/service";
import { finaliseOrderFromCheckout } from "./checkouts";

const TEST_PACKAGE_ID = "00000000-0000-0000-0000-000000000001";

class FakeAiraloClient {
  readonly syncPayloads: CreateOrderPayload[] = [];

  constructor(private readonly syncResponse: OrderResponse) {}

  async createOrderResponse(payload: CreateOrderPayload): Promise<OrderResponse> {
    this.syncPayloads.push(payload);
    return this.syncResponse;
  }
}

class FakeCheckoutDb {
  readonly orders: Array<Record<string, unknown>> = [];
  readonly profiles: Array<Record<string, unknown>> = [];
  readonly installationPayloads: Array<Record<string, unknown>> = [];
  readonly snapshots: Array<Record<string, unknown>> = [];

  readonly payment = {
    id: "payment-1",
    userId: "user-1",
    provider: "dpo",
    providerReference: "checkout-1",
    transactionToken: "token-1",
    redirectUrl: "https://payments.example/checkout",
    status: "approved",
    amountCents: 2500,
    currency: "UGX",
    statusHistory: null as string | null,
    metadata: null,
    checkoutId: "checkout-1",
    createdAt: new Date("2026-05-09T10:00:00Z"),
    updatedAt: new Date("2026-05-09T10:00:00Z"),
  };

  readonly checkout = {
    id: "checkout-1",
    userId: "user-1",
    packageId: TEST_PACKAGE_ID,
    customerEmail: "checkout@example.com",
    quantity: 2,
    totalCents: 2500,
    currency: "UGX",
    status: "paid",
    intent: "purchase",
    topUpForOrderId: null,
    topUpForIccid: null,
    orderId: null as string | null,
    metadata: null,
    createdAt: new Date("2026-05-09T10:00:00Z"),
    updatedAt: new Date("2026-05-09T10:00:00Z"),
    package: {
      id: TEST_PACKAGE_ID,
      airaloPackageId: "pkg-test",
      title: "Test 1GB",
    },
    payments: [this.payment],
  };

  readonly checkoutSession = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: { orderId?: boolean };
    }) => {
      if (where.id !== this.checkout.id) {
        return null;
      }

      if (select?.orderId) {
        return { orderId: this.checkout.orderId };
      }

      return {
        ...this.checkout,
        package: this.checkout.package,
        payments: [this.payment],
      };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; orderId?: string | null };
      data: Record<string, unknown>;
    }) => {
      if (where.id !== this.checkout.id) {
        return { count: 0 };
      }

      if ("orderId" in where && this.checkout.orderId !== where.orderId) {
        return { count: 0 };
      }

      Object.assign(this.checkout, data);
      return { count: 1 };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      assert.equal(where.id, this.checkout.id);
      Object.assign(this.checkout, data);
      return this.checkout;
    },
  };

  readonly esimOrder = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: `order-${this.orders.length + 1}`,
        orderNumber: null,
        requestId: null,
        ...data,
      };
      this.orders.push(record);
      return record;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return this.orders.find((order) => order.id === where.id) ?? null;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const order = this.orders.find((candidate) => candidate.id === where.id);
      assert.ok(order, `order ${where.id} should exist`);
      Object.assign(order, data);
      return order;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id?: string;
        orderNumber?: string | null;
        requestId?: string | null;
        status?: { in?: string[] } | string;
      };
      data: Record<string, unknown>;
    }) => {
      let count = 0;
      for (const order of this.orders) {
        if (where.id && order.id !== where.id) continue;
        if ("orderNumber" in where && order.orderNumber !== where.orderNumber) {
          continue;
        }
        if ("requestId" in where && order.requestId !== where.requestId) {
          continue;
        }
        if (typeof where.status === "string" && order.status !== where.status) {
          continue;
        }
        if (
          typeof where.status === "object" &&
          where.status?.in &&
          !where.status.in.includes(String(order.status))
        ) {
          continue;
        }

        Object.assign(order, data);
        count += 1;
      }
      return { count };
    },
  };

  readonly paymentTransaction = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      return where.id === this.payment.id ? this.payment : null;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      assert.equal(where.id, this.payment.id);
      Object.assign(this.payment, data);
      return this.payment;
    },
  };

  readonly package = {
    findFirst: async () => ({
      id: TEST_PACKAGE_ID,
      airaloPackageId: "pkg-test",
      title: "Test 1GB",
      operator: {
        country: {
          title: "Uganda",
        },
      },
    }),
  };

  readonly airaloOrderSnapshot = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.snapshots.push(data);
      return { id: `snapshot-${this.snapshots.length}`, ...data };
    },
  };

  readonly esimProfile = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { iccid: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const existing = this.profiles.find(
        (profile) => profile.iccid === where.iccid,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }

      const record = {
        id: `profile-${this.profiles.length + 1}`,
        ...create,
        ...update,
      };
      this.profiles.push(record);
      return record;
    },
  };

  readonly esimInstallationPayload = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { orderId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const existing = this.installationPayloads.find(
        (payload) => payload.orderId === where.orderId,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }

      const record = {
        id: `installation-${this.installationPayloads.length + 1}`,
        ...create,
        ...update,
      };
      this.installationPayloads.push(record);
      return record;
    },
  };

  async $transaction<T>(fn: (tx: FakeCheckoutDb) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

function createSyncAiraloClient(): FakeAiraloClient {
  return new FakeAiraloClient(
    OrderResponseSchema.parse({
      status: true,
      data: {
        order_id: "A-ORDER-1",
        order_reference: "REF-1",
        status: "completed",
        iccid: "8900000000000000001",
        activation_code: "LPA:1$example$activation",
      },
    }),
  );
}

function createFinaliseOptions(db: FakeCheckoutDb, airalo: FakeAiraloClient) {
  return {
    prisma: db as unknown as PrismaClient,
    airaloOptions: {
      airaloClient: airalo as unknown as AiraloClient,
      submissionMode: "sync",
    } satisfies CreateOrderOptions,
    forceStatus: "approved",
  };
}

test("finaliseOrderFromCheckout reserves a local order before Airalo and uses the checkout snapshot", async () => {
  const db = new FakeCheckoutDb();
  const airalo = createSyncAiraloClient();

  const result = await finaliseOrderFromCheckout(
    "checkout-1",
    createFinaliseOptions(db, airalo),
  );

  assert.equal(result.orderId, "order-1");
  assert.equal(db.checkout.orderId, "order-1");
  assert.equal(db.checkout.status, "paid");
  assert.equal(airalo.syncPayloads.length, 1);
  assert.equal(airalo.syncPayloads[0]?.package_id, "pkg-test");
  assert.equal(airalo.syncPayloads[0]?.quantity, "2");
  assert.equal(airalo.syncPayloads[0]?.description, "2 x Test 1GB");
  assert.equal(db.orders[0]?.totalCents, 2500);
  assert.equal(db.orders[0]?.currency, "UGX");
  assert.equal(db.orders[0]?.customerEmail, "checkout@example.com");
});

test("finaliseOrderFromCheckout is idempotent once a checkout has a reserved order", async () => {
  const db = new FakeCheckoutDb();
  const airalo = createSyncAiraloClient();

  const first = await finaliseOrderFromCheckout(
    "checkout-1",
    createFinaliseOptions(db, airalo),
  );
  const second = await finaliseOrderFromCheckout(
    "checkout-1",
    createFinaliseOptions(db, airalo),
  );

  assert.equal(first.orderId, "order-1");
  assert.equal(second.orderId, "order-1");
  assert.equal(db.orders.length, 1);
  assert.equal(airalo.syncPayloads.length, 1);
});
