import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";
import type {
  AiraloClient,
  CreateOrderPayload,
  CreateTopUpOrderPayload,
} from "../airalo/client";
import { AiraloError } from "../airalo/client";
import { OrderResponseSchema, type OrderResponse } from "../airalo/schemas";
import type { CreateOrderOptions } from "../orders/service";
import {
  createCheckout,
  finaliseOrderFromCheckout,
  verifyPaymentTransaction,
} from "./checkouts";
import { prepareCheckoutRequestPayload } from "./checkout-request";
import type { CheckoutRequestError } from "./checkout-request";

const TEST_PACKAGE_ID = "00000000-0000-0000-0000-000000000001";

test("guest purchase checkout requests require an email", () => {
  let caught: unknown;
  try {
    prepareCheckoutRequestPayload(
      { packageId: TEST_PACKAGE_ID },
      { isAuthenticated: false },
    );
  } catch (error) {
    caught = error;
  }

  assert.equal((caught as CheckoutRequestError).name, "CheckoutRequestError");
  assert.equal((caught as CheckoutRequestError).status, 422);
});

test("checkout request emails are normalized before checkout creation", () => {
  const payload = prepareCheckoutRequestPayload(
    { packageId: TEST_PACKAGE_ID, customerEmail: " Customer@Example.COM " },
    { isAuthenticated: false },
  );

  assert.equal(payload.customerEmail, "customer@example.com");
});

test("signed-in checkout requests default to the session email", () => {
  const payload = prepareCheckoutRequestPayload(
    { packageId: TEST_PACKAGE_ID },
    {
      isAuthenticated: true,
      sessionEmail: " Traveler@Example.COM ",
    },
  );

  assert.equal(payload.customerEmail, "traveler@example.com");
});

class FakeCreateCheckoutDb {
  lastWhere: unknown = null;

  readonly package = {
    findFirst: async ({ where }: { where: unknown }) => {
      this.lastWhere = where;
      return null;
    },
  };
}

test("createCheckout purchase rejects top-up package IDs through public sim lookup", async () => {
  const db = new FakeCreateCheckoutDb();

  await assert.rejects(
    () =>
      createCheckout(
        {
          packageId: "ke-1gb-7d-topup",
          customerEmail: "traveler@example.com",
        },
        {
          prisma: db as unknown as PrismaClient,
          baseUrl: "https://example.com",
        },
      ),
    /Selected package is unavailable/,
  );

  const serializedWhere = JSON.stringify(db.lastWhere);
  assert.match(serializedWhere, /"type":"sim"/);
  assert.match(serializedWhere, /"sellingPriceCents"/);
  assert.match(serializedWhere, /"countryCode"/);
});

test("createCheckout top-up intent uses top-up package lookup", async () => {
  const db = new FakeCreateCheckoutDb();

  await assert.rejects(
    () =>
      createCheckout(
        {
          packageId: "ke-1gb-7d-topup",
          customerEmail: "traveler@example.com",
          intent: "top-up",
          topUpForOrderId: "order-1",
          topUpForIccid: "8910300000005271146",
        },
        {
          prisma: db as unknown as PrismaClient,
          baseUrl: "https://example.com",
        },
      ),
    /Selected package is unavailable/,
  );

  const serializedWhere = JSON.stringify(db.lastWhere);
  assert.match(serializedWhere, /"type":"topup"/);
  assert.doesNotMatch(serializedWhere, /"countryCode"/);
});

class FakeAiraloClient {
  readonly syncPayloads: CreateOrderPayload[] = [];
  readonly topUpPayloads: CreateTopUpOrderPayload[] = [];

  constructor(
    private readonly syncResponse: OrderResponse,
    private readonly topUpResponse: OrderResponse = syncResponse,
  ) {}

  async createOrderResponse(payload: CreateOrderPayload): Promise<OrderResponse> {
    this.syncPayloads.push(payload);
    return this.syncResponse;
  }

  async createTopUpOrderResponse(
    payload: CreateTopUpOrderPayload,
  ): Promise<OrderResponse> {
    this.topUpPayloads.push(payload);
    return this.topUpResponse;
  }
}

class FakeCheckoutDb {
  readonly orders: Array<Record<string, unknown>> = [];
  readonly paymentEvents: Array<Record<string, unknown>> = [];
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
    quantity: 1,
    totalCents: 2500,
    currency: "UGX",
    status: "paid",
    intent: "purchase",
    topUpForOrderId: null as string | null,
    topUpForIccid: null as string | null,
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
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: { checkout?: unknown };
      select?: unknown;
    }) => {
      if (where.id !== this.payment.id) {
        return null;
      }

      if (include?.checkout) {
        return {
          ...this.payment,
          checkout: {
            ...this.checkout,
            payments: [this.payment],
          },
        };
      }

      return this.payment;
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

  readonly paymentTransactionEvent = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = { id: `payment-event-${this.paymentEvents.length + 1}`, ...data };
      this.paymentEvents.push(record);
      return record;
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
    findFirst: async ({
      where,
    }: {
      where: { orderId?: string; iccid?: string };
      select?: { id?: boolean };
    }) => {
      return (
        this.profiles.find(
          (profile) =>
            (!where.orderId || profile.orderId === where.orderId) &&
            (!where.iccid || profile.iccid === where.iccid),
        ) ?? null
      );
    },
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

function createTopUpAiraloClient(): FakeAiraloClient {
  return new FakeAiraloClient(
    OrderResponseSchema.parse({
      status: true,
      data: {
        order_id: "A-ORDER-1",
        order_reference: "REF-1",
        status: "completed",
        iccid: "8900000000000000001",
      },
    }),
    OrderResponseSchema.parse({
      data: {
        id: 111,
        code: "20251118-000111",
        package_id: "bonbon-mobile-30days-3gb-topup",
        currency: "USD",
        quantity: 1,
        type: "topup",
        description: "Topup (8910300000005271146)",
        esim_type: "local",
        validity: 30,
        package: "3 GB - 100 SMS - 100 Mins - 30 Days",
        data: "3 GB",
        price: 10,
        pricing_model: "net_pricing",
        text: null,
        voice: null,
        net_price: 8,
        created_at: "2025-11-18 13:37:07",
        manual_installation: "<p>Manual</p>",
        qrcode_installation: "<p>QR</p>",
        installation_guides: {
          en: "https://www.airalo.com/help/getting-started-with-airalo",
        },
      },
      meta: { message: "success" },
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
  assert.equal(airalo.syncPayloads[0]?.quantity, "1");
  assert.equal(
    airalo.syncPayloads[0]?.description,
    "1 x Test 1GB [simplify_order_id:order-1]",
  );
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

test("finaliseOrderFromCheckout submits paid top-ups through the documented endpoint", async () => {
  const db = new FakeCheckoutDb();
  const airalo = createTopUpAiraloClient();
  db.checkout.intent = "top-up";
  db.checkout.quantity = 1;
  db.checkout.totalCents = 1500;
  db.checkout.topUpForOrderId = "original-order-1";
  db.checkout.topUpForIccid = "8910300000005271146";
  db.checkout.package.airaloPackageId = "bonbon-mobile-30days-3gb-topup";
  db.checkout.package.title = "3 GB - 30 Days";
  db.profiles.push({
    id: "profile-original",
    iccid: "8910300000005271146",
    orderId: "original-order-1",
    status: "ACTIVE",
  });

  const result = await finaliseOrderFromCheckout(
    "checkout-1",
    createFinaliseOptions(db, airalo),
  );

  assert.equal(result.orderId, "order-1");
  assert.equal(result.redirectOrderId, "original-order-1");
  assert.equal(db.checkout.orderId, "order-1");
  assert.equal(db.checkout.status, "paid");
  assert.equal(airalo.syncPayloads.length, 0);
  assert.equal(airalo.topUpPayloads.length, 1);
  const topUpPayload = airalo.topUpPayloads[0];
  assert.ok(topUpPayload);
  assert.deepEqual(Object.keys(topUpPayload).sort(), [
    "description",
    "iccid",
    "package_id",
  ]);
  assert.deepEqual(topUpPayload, {
    package_id: "bonbon-mobile-30days-3gb-topup",
    iccid: "8910300000005271146",
    description: "Topup (8910300000005271146) [simplify_order_id:order-1]",
  });
  assert.equal(db.orders[0]?.orderNumber, "111");
  assert.equal(db.orders[0]?.requestId, "111");
  assert.equal(db.orders[0]?.status, "completed");
  assert.equal(db.orders[0]?.quantity, 1);
  assert.equal(db.snapshots[0]?.source, "orders-topups");
  assert.equal(db.profiles.length, 1);
  assert.equal(db.profiles[0]?.orderId, "original-order-1");
  assert.equal(db.installationPayloads.length, 0);
});

test("finaliseOrderFromCheckout rejects invalid top-up checkout context before Airalo", async () => {
  const db = new FakeCheckoutDb();
  const airalo = createTopUpAiraloClient();
  db.checkout.intent = "top-up";
  db.checkout.quantity = 2;
  db.checkout.topUpForOrderId = "original-order-1";
  db.checkout.topUpForIccid = "8910300000005271146";

  await assert.rejects(
    () => finaliseOrderFromCheckout("checkout-1", createFinaliseOptions(db, airalo)),
    /Top-up checkouts must have a quantity of 1/,
  );

  assert.equal(airalo.syncPayloads.length, 0);
  assert.equal(airalo.topUpPayloads.length, 0);
  assert.equal(db.orders.length, 0);
});

test("verifyPaymentTransaction rejects verified DPO amount mismatches before Airalo", async () => {
  const db = new FakeCheckoutDb();
  db.payment.status = "pending";
  db.payment.providerReference = "R84690953";
  db.checkout.status = "pending";
  let verifiedToken: string | undefined;
  let verifiedCompanyRef: string | undefined;

  const result = await verifyPaymentTransaction("payment-1", {
    prisma: db as unknown as PrismaClient,
    source: "dpo-push",
    dpoClient: {
      verifyTransaction: async (token, companyRef) => {
        verifiedToken = token;
        verifiedCompanyRef = companyRef;
        return {
          status: "000",
          resultCode: "000",
          resultExplanation: "Transaction Paid",
          amount: 26,
          currency: "UGX",
          rawResponse: "<API3G><Result>000</Result></API3G>",
        };
      },
    },
  });

  assert.equal(verifiedToken, "token-1");
  assert.equal(verifiedCompanyRef, "checkout-1");
  assert.equal(result.paymentStatus, "verification_mismatch");
  assert.match(result.message ?? "", /amount mismatch/i);
  assert.equal(db.checkout.orderId, null);
  assert.equal(db.orders.length, 0);
  assert.equal(db.paymentEvents[0]?.eventType, "dpo-push-mismatch");
});

type PurchaseMode = "sync" | "async" | "top-up";

function reservedCheckout(mode: PurchaseMode, status = "pending"): FakeCheckoutDb {
  const db = new FakeCheckoutDb();
  db.checkout.orderId = "reserved-order";
  if (mode === "top-up") {
    db.checkout.intent = "top-up";
    db.checkout.quantity = 1;
    db.checkout.topUpForOrderId = "original-order";
    db.checkout.topUpForIccid = "8910300000005271146";
    db.profiles.push({ id: "original-profile", orderId: "original-order", iccid: db.checkout.topUpForIccid });
  }
  db.orders.push({
    id: db.checkout.orderId, status, orderNumber: null, requestId: null,
    packageId: db.checkout.packageId, userId: db.checkout.userId,
    quantity: db.checkout.quantity, totalCents: db.checkout.totalCents,
    currency: db.checkout.currency, customerEmail: db.checkout.customerEmail,
  });
  return db;
}

function purchaseOptions(db: FakeCheckoutDb, mode: PurchaseMode, purchase: () => Promise<OrderResponse>) {
  return {
    prisma: db as unknown as PrismaClient,
    airaloOptions: {
      airaloClient: {
        createOrderResponse: purchase,
        createTopUpOrderResponse: purchase,
        createOrderAsyncResponse: async () => {
          await purchase();
          return { data: { request_id: "supplier-request", accepted_at: "2026-10-17T10:00:00Z" } };
        },
      } as unknown as AiraloClient,
      submissionMode: mode === "async" ? "async" as const : "sync" as const,
      asyncWebhookUrl: "https://hooks.example.com/airalo",
    },
  };
}

test("concurrent paid purchase retries share one supplier submission", async (t) => {
  const previousSecret = process.env.AIRALO_WEBHOOK_SECRET;
  process.env.AIRALO_WEBHOOK_SECRET = "test-webhook-secret";
  try {
    for (const mode of ["sync", "async", "top-up"] as const) {
      for (const status of ["pending", "airalo_rejected"]) {
        await t.test(`${mode}: ${status}`, async () => {
          const db = reservedCheckout(mode, status);
          let calls = 0;
          let release!: () => void;
          let signalStarted!: () => void;
          const started = new Promise<void>(resolve => { signalStarted = resolve; });
          const held = new Promise<void>(resolve => { release = resolve; });
          const options = purchaseOptions(db, mode, async () => {
            calls++;
            signalStarted();
            await held;
            return { data: { id: "supplier-order", status: "completed" } };
          });
          const first = finaliseOrderFromCheckout(db.checkout.id, options);
          await started;
          try {
            const concurrent = await finaliseOrderFromCheckout(db.checkout.id, options);
            assert.equal(concurrent.orderId, "reserved-order");
            assert.equal(calls, 1);
            assert.equal(db.orders[0]?.status, "airalo_submitting");
          } finally {
            release();
          }
          await first;
          await finaliseOrderFromCheckout(db.checkout.id, options);
          assert.equal(calls, 1);
          assert.equal(db.snapshots.length, 1);
        });
      }
    }
  } finally {
    if (previousSecret === undefined) delete process.env.AIRALO_WEBHOOK_SECRET;
    else process.env.AIRALO_WEBHOOK_SECRET = previousSecret;
  }
});

test("unknown purchase outcomes cannot be resubmitted by checkout finalization", async (t) => {
  for (const mode of ["sync", "top-up"] as const) {
    for (const [name, failure] of [
      ["server error", new AiraloError("Upstream failure", { status: 500, statusText: "Server error" })],
      ["lost response", new TypeError("Socket closed after request was sent")],
      ["malformed success", new SyntaxError("Invalid response JSON")],
      ["unexpected business failure", new AiraloError("Unexpected error", { status: 422, statusText: "Unprocessable", body: { code: 53 } })],
    ] as const) {
      await t.test(`${mode}: ${name}`, async () => {
        const db = reservedCheckout(mode);
        let calls = 0;
        const options = purchaseOptions(db, mode, async () => { calls++; throw failure; });
        await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
        assert.equal(db.orders[0]?.status, "airalo_outcome_unknown");
        await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options), /Reconcile the existing order/);
        assert.equal(calls, 1);
      });
    }
    await t.test(`${mode}: accepted response without a supplier reference`, async () => {
      const db = reservedCheckout(mode);
      let calls = 0;
      const options = purchaseOptions(db, mode, async () => { calls++; return { data: { status: "completed" } }; });
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
      assert.equal(db.orders[0]?.status, "airalo_outcome_unknown");
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options), /Reconcile/);
      assert.equal(calls, 1);
    });
    await t.test(`${mode}: database failure after supplier acceptance`, async () => {
      const db = reservedCheckout(mode);
      db.esimOrder.update = async () => { throw new Error("Database unavailable after purchase"); };
      let calls = 0;
      const options = purchaseOptions(db, mode, async () => { calls++; return { data: { id: "supplier-order" } }; });
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
      assert.equal(db.orders[0]?.status, "airalo_outcome_unknown");
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options), /Reconcile/);
      assert.equal(calls, 1);
    });
  }
});

test("confirmed supplier rejection permits a later claimed attempt, but legacy failures do not", async (t) => {
  for (const mode of ["sync", "top-up"] as const) {
    await t.test(`${mode}: confirmed rejection`, async () => {
      const db = reservedCheckout(mode);
      let calls = 0;
      const options = purchaseOptions(db, mode, async () => {
        calls++;
        if (calls === 1) throw new AiraloError("Rate limited", { status: 429, statusText: "Too Many Requests" });
        return { data: { id: "supplier-order", status: "completed" } };
      });
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
      assert.equal(calls, 1, "no nested rate-limit retry may replay this attempt");
      assert.equal(db.orders[0]?.status, "airalo_rejected");
      await finaliseOrderFromCheckout(db.checkout.id, options);
      await finaliseOrderFromCheckout(db.checkout.id, options);
      assert.equal(calls, 2);
    });
    await t.test(`${mode}: legacy failure`, async () => {
      const db = reservedCheckout(mode, "airalo_failed");
      let calls = 0;
      const options = purchaseOptions(db, mode, async () => { calls++; return { data: { id: "unexpected" } }; });
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options), /Reconcile/);
      assert.equal(calls, 0);
    });
  }
});

test("async acceptance uncertainty is retained without resubmitting or falling back to sync", async (t) => {
  const previousSecret = process.env.AIRALO_WEBHOOK_SECRET;
  process.env.AIRALO_WEBHOOK_SECRET = "test-webhook-secret";
  try {
    for (const failure of ["server error", "lost response", "empty acknowledgement", "persistence failure"] as const) {
      await t.test(failure, async () => {
        const db = reservedCheckout("async");
        let calls = 0;
        const options = purchaseOptions(db, "async", async () => { throw new Error("Sync fallback must not run"); });
        options.airaloOptions.airaloClient.createOrderAsyncResponse = async () => {
          calls++;
          if (failure === "server error") throw new AiraloError("Upstream failure", { status: 500, statusText: "Server error" });
          if (failure === "lost response") throw new TypeError("Socket closed");
          return {
            data: { request_id: failure === "empty acknowledgement" ? "" : "supplier-request", accepted_at: "2026-10-17T10:00:00Z" },
            meta: { message: "success" },
          };
        };
        if (failure === "persistence failure") {
          const updateMany = db.esimOrder.updateMany;
          db.esimOrder.updateMany = async (args) => {
            if (args.data.requestId === "supplier-request") throw new Error("Database unavailable after acceptance");
            return updateMany(args);
          };
        }
        await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
        assert.equal(db.orders[0]?.status, "airalo_outcome_unknown");
        await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options), /Reconcile/);
        assert.equal(calls, 1);
      });
    }
  } finally {
    if (previousSecret === undefined) delete process.env.AIRALO_WEBHOOK_SECRET;
    else process.env.AIRALO_WEBHOOK_SECRET = previousSecret;
  }
});

test("a lost outcome-state write leaves the submission claim closed", async (t) => {
  for (const mode of ["sync", "top-up"] as const) {
    await t.test(mode, async () => {
      const db = reservedCheckout(mode);
      const updateMany = db.esimOrder.updateMany;
      db.esimOrder.updateMany = async (args) => {
        if (args.data.status === "airalo_outcome_unknown") throw new Error("Cannot persist outcome");
        return updateMany(args);
      };
      let calls = 0;
      const options = purchaseOptions(db, mode, async () => {
        calls++;
        throw new TypeError("Response was lost");
      });
      await assert.rejects(() => finaliseOrderFromCheckout(db.checkout.id, options));
      assert.equal(db.orders[0]?.status, "airalo_submitting");
      await finaliseOrderFromCheckout(db.checkout.id, options);
      assert.equal(calls, 1);
    });
  }
});

test("createCheckout rejects multiple-SIM requests before payment creation", async () => {
  const db = new FakeCreateCheckoutDb();
  await assert.rejects(createCheckout({ packageId: TEST_PACKAGE_ID, quantity: 2 }, {
    prisma: db as unknown as PrismaClient, baseUrl: "https://example.com",
  }), /one eSIM per checkout/);
  assert.equal(db.lastWhere, null);
});

test("legacy paid multiple-SIM checkouts cannot submit a partial supplier purchase", async () => {
  const db = new FakeCheckoutDb();
  db.checkout.quantity = 2;
  const airalo = createSyncAiraloClient();
  await assert.rejects(finaliseOrderFromCheckout("checkout-1", createFinaliseOptions(db, airalo)));
  assert.equal(airalo.syncPayloads.length, 0);
  assert.equal(airalo.topUpPayloads.length, 0);
});
