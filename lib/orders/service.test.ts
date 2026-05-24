import assert from "node:assert/strict";
import test from "node:test";

import {
  AiraloError,
  type AiraloClient,
  type CreateOrderPayload,
} from "../airalo/client";
import {
  OrderResponseSchema,
  type OrderResponse,
  type SimResponse,
  type SubmitOrderAsyncResponse,
} from "../airalo/schemas";
import {
  OrderValidationError,
  createOrder,
  ensureOrderInstallation,
  type CreateOrderInput,
  type CreateOrderOptions,
} from "./service";
import { createInstallationPayload } from "./airalo-metadata";

const TEST_PACKAGE_ID = "00000000-0000-0000-0000-000000000001";

async function withBrandSettingsEnv<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const original = process.env.AIRALO_BRAND_SETTINGS_NAME;

  if (value === undefined) {
    delete process.env.AIRALO_BRAND_SETTINGS_NAME;
  } else {
    process.env.AIRALO_BRAND_SETTINGS_NAME = value;
  }

  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.AIRALO_BRAND_SETTINGS_NAME;
    } else {
      process.env.AIRALO_BRAND_SETTINGS_NAME = original;
    }
  }
}

type SnapshotRecord = {
  orderId: string;
  source: string;
  requestId: string | null;
  orderNumber: string | null;
  rawPayloadJson: unknown;
};

class FakeOrderDb {
  readonly orders: Array<Record<string, unknown>> = [];
  readonly profiles: Array<Record<string, unknown>> = [];
  readonly installationPayloads: Array<Record<string, unknown>> = [];
  readonly snapshots: SnapshotRecord[] = [];

  readonly packageRecord = {
    id: TEST_PACKAGE_ID,
    airaloPackageId: "pkg-test",
    title: "Test 1GB",
    state: {
      isActive: true,
      sellingPriceCents: 1250,
      currencyCode: "USD",
    },
  };

  readonly package = {
    findFirst: async () => this.packageRecord,
  };

  readonly packageState = {
    updateMany: async () => ({ count: 1 }),
  };

  readonly esimOrder = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: `order-${this.orders.length + 1}`,
        ...data,
      };
      this.orders.push(record);
      return record;
    },
    findFirst: async ({
      where,
    }: {
      where: { OR?: Array<Record<string, unknown>> };
    }) => {
      const clauses = where.OR ?? [];
      const order = this.orders.find((candidate) =>
        clauses.some((clause) =>
          Object.entries(clause).some(
            ([key, value]) => candidate[key] === value,
          ),
        ),
      );

      if (!order) {
        return null;
      }

      return {
        ...order,
        profiles: this.profiles.filter(
          (profile) => profile.orderId === order.id,
        ),
        installation:
          this.installationPayloads.find(
            (payload) => payload.orderId === order.id,
          ) ?? null,
        payment: null,
      };
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const order = this.orders.find((candidate) => candidate.id === where.id);
      return order
        ? {
            ...order,
            profiles: this.profiles.filter(
              (profile) => profile.orderId === order.id,
            ),
            installation:
              this.installationPayloads.find(
                (payload) => payload.orderId === order.id,
              ) ?? null,
            payment: null,
          }
        : null;
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
        if (where.id && order.id !== where.id) {
          continue;
        }
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
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.orders.find((order) => order.id === where.id);
      assert.ok(record, `order ${where.id} should exist`);
      Object.assign(record, data);
      return record;
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

  readonly airaloOrderSnapshot = {
    create: async ({ data }: { data: SnapshotRecord }) => {
      this.snapshots.push(data);
      return {
        id: `snapshot-${this.snapshots.length}`,
        ...data,
      };
    },
  };

  async $transaction<T>(fn: (tx: FakeOrderDb) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

class FakeAiraloClient {
  readonly asyncPayloads: CreateOrderPayload[] = [];
  readonly syncPayloads: CreateOrderPayload[] = [];
  readonly simLookups: Array<{ iccid: string; include?: unknown }> = [];
  readonly orderLookups: string[] = [];

  constructor(
    private readonly options: {
      asyncResponse?: SubmitOrderAsyncResponse;
      syncResponse?: OrderResponse;
      orderResponse?: OrderResponse;
      simResponse?: SimResponse;
      syncError?: Error;
      asyncError?: Error;
      orderError?: Error;
      simError?: Error;
    },
  ) {}

  async createOrderAsyncResponse(
    payload: CreateOrderPayload,
  ): Promise<SubmitOrderAsyncResponse> {
    this.asyncPayloads.push(payload);

    if (this.options.asyncError) {
      throw this.options.asyncError;
    }

    assert.ok(this.options.asyncResponse, "async response must be configured");
    return this.options.asyncResponse;
  }

  async createOrderResponse(
    payload: CreateOrderPayload,
  ): Promise<OrderResponse> {
    this.syncPayloads.push(payload);

    if (this.options.syncError) {
      throw this.options.syncError;
    }

    assert.ok(this.options.syncResponse, "sync response must be configured");
    return this.options.syncResponse;
  }

  async getOrderResponseById(orderId: string): Promise<OrderResponse> {
    this.orderLookups.push(orderId);

    if (this.options.orderError) {
      throw this.options.orderError;
    }

    assert.ok(this.options.orderResponse, "order response must be configured");
    return this.options.orderResponse;
  }

  async getSimResponse(
    iccid: string,
    options: { include?: unknown } = {},
  ): Promise<SimResponse> {
    this.simLookups.push({ iccid, include: options.include });

    if (this.options.simError) {
      throw this.options.simError;
    }

    assert.ok(this.options.simResponse, "SIM response must be configured");
    return this.options.simResponse;
  }
}

function createTestOrder(
  input: Partial<CreateOrderInput>,
  options: {
    db: FakeOrderDb;
    airalo: FakeAiraloClient;
    submissionMode: "async" | "sync";
    asyncWebhookUrl?: string;
  },
) {
  return createOrder(
    {
      packageId: "pkg-test",
      quantity: 1,
      ...input,
    },
    {
      prisma: options.db as unknown as CreateOrderOptions["prisma"],
      airaloClient: options.airalo as unknown as AiraloClient,
      submissionMode: options.submissionMode,
      asyncWebhookUrl: options.asyncWebhookUrl,
    },
  );
}

test("createOrder sends /orders-async webhook_url and persists request_id with raw ack snapshot", async () => {
  await withBrandSettingsEnv(undefined, async () => {
    const db = new FakeOrderDb();
    const asyncResponse: SubmitOrderAsyncResponse = {
      status: true,
      data: {
        request_id: "req_123",
        accepted_at: "2026-05-09T10:00:00Z",
      },
      meta: { message: "success" },
    };
    const airalo = new FakeAiraloClient({ asyncResponse });

    const result = await createTestOrder(
      {
        quantity: 2,
        customerEmail: "customer@example.com",
      },
      {
        db,
        airalo,
        submissionMode: "async",
        asyncWebhookUrl: "https://example.com/api/airalo/webhooks",
      },
    );

    assert.equal(airalo.asyncPayloads.length, 1);
    assert.equal(
      airalo.asyncPayloads[0]?.webhook_url,
      "https://example.com/api/airalo/webhooks",
    );
    assert.equal(airalo.asyncPayloads[0]?.quantity, "2");
    assert.equal(airalo.asyncPayloads[0]?.brand_settings_name, undefined);
    assert.equal(airalo.asyncPayloads[0]?.to_email, "customer@example.com");
    assert.deepEqual(airalo.asyncPayloads[0]?.["sharing_option[]"], ["link"]);
    assert.equal(db.orders[0]?.requestId, "req_123");
    assert.equal(result.requestId, "req_123");
    assert.equal(db.snapshots.length, 1);
    assert.equal(db.snapshots[0]?.source, "orders-async");
    assert.equal(db.snapshots[0]?.requestId, "req_123");
    assert.deepEqual(db.snapshots[0]?.rawPayloadJson, asyncResponse);
  });
});

test("createOrder sends configured Airalo brand settings name", async () => {
  await withBrandSettingsEnv("Brand Test Production", async () => {
    const db = new FakeOrderDb();
    const asyncResponse: SubmitOrderAsyncResponse = {
      status: true,
      data: {
        request_id: "req_brand",
        accepted_at: "2026-05-09T10:00:00Z",
      },
      meta: { message: "success" },
    };
    const airalo = new FakeAiraloClient({ asyncResponse });

    await createTestOrder(
      { quantity: 1 },
      {
        db,
        airalo,
        submissionMode: "async",
        asyncWebhookUrl: "https://example.com/api/airalo/webhooks",
      },
    );

    assert.equal(
      airalo.asyncPayloads[0]?.brand_settings_name,
      "Brand Test Production",
    );
  });
});

test("createOrder stores rich /orders response data, APN, and raw snapshot", async () => {
  await withBrandSettingsEnv(undefined, async () => {
    const db = new FakeOrderDb();
    const syncResponse = OrderResponseSchema.parse({
      status: true,
      data: {
        order_id: "A-ORDER-1",
        order_reference: "REF-1",
        status: "completed",
        iccid: "8900000000000000001",
        activation_code: "LPA:1$example$activation",
        direct_apple_installation_url: "https://example.com/apple-install",
        apn: "globaldata",
        net_price: "4.50",
        voice: 30,
        text: 100,
        sims: [
          {
            iccid: "8900000000000000001",
            activation_code: "LPA:1$example$activation",
            apn_value: "sim-apn",
            direct_apple_installation_url: "https://example.com/apple-install",
          },
        ],
      },
    });
    const airalo = new FakeAiraloClient({ syncResponse });

    const result = await createTestOrder(
      { quantity: 1 },
      {
        db,
        airalo,
        submissionMode: "sync",
      },
    );

    assert.equal(result.orderNumber, "A-ORDER-1");
    assert.equal(airalo.syncPayloads[0]?.brand_settings_name, undefined);
    assert.equal(result.requestId, "REF-1");
    assert.equal(result.installation?.apn, "globaldata");
    assert.equal(db.profiles[0]?.iccid, "8900000000000000001");
    assert.equal(db.snapshots.length, 1);
    assert.equal(db.snapshots[0]?.source, "orders");
    assert.equal(db.snapshots[0]?.orderNumber, "A-ORDER-1");
    assert.deepEqual(db.snapshots[0]?.rawPayloadJson, syncResponse);

    const installationPayload = JSON.parse(
      String(db.installationPayloads[0]?.payload),
    ) as Record<string, unknown>;
    assert.equal(
      installationPayload.directAppleUrl,
      "https://example.com/apple-install",
    );
    assert.equal(installationPayload.apn, "globaldata");
    assert.equal(
      (db.snapshots[0]?.rawPayloadJson as OrderResponse).data.net_price,
      "4.50",
    );
    assert.equal(
      (db.snapshots[0]?.rawPayloadJson as OrderResponse).data.voice,
      30,
    );
    assert.equal(
      (db.snapshots[0]?.rawPayloadJson as OrderResponse).data.text,
      100,
    );
  });
});

test("createOrder stores the documented Airalo order id before the display code", async () => {
  const db = new FakeOrderDb();
  const syncResponse = OrderResponseSchema.parse({
    status: true,
    data: {
      id: 583747,
      code: "20250415-583747",
      status: "completed",
      package_id: "uki-mobile-15days-2gb",
      quantity: 1,
      type: "sim",
      sims: [
        {
          iccid: "8944465400003573253",
          qrcode: "LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ",
          direct_apple_installation_url:
            "https://example.com/apple-install",
        },
      ],
    },
  });
  const airalo = new FakeAiraloClient({ syncResponse });

  const result = await createTestOrder(
    { quantity: 1 },
    {
      db,
      airalo,
      submissionMode: "sync",
    },
  );

  assert.equal(result.orderNumber, "583747");
  assert.equal(db.orders[0]?.orderNumber, "583747");
  assert.equal(db.profiles[0]?.activationCode, "YVTGM-5LZC6-PIC56-KFEZJ");
  assert.equal(db.snapshots[0]?.orderNumber, "583747");

  const installationPayload = JSON.parse(
    String(db.installationPayloads[0]?.payload),
  ) as Record<string, unknown>;
  assert.equal(installationPayload.source, "order");
  assert.equal(installationPayload.orderId, "583747");
  assert.equal(installationPayload.qrCodeData, "LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ");
  assert.equal(installationPayload.matchingId, "YVTGM-5LZC6-PIC56-KFEZJ");
});

test("createOrder hydrates a reserved checkout order using the checkout price snapshot", async () => {
  const db = new FakeOrderDb();
  db.orders.push({
    id: "reserved-order-1",
    orderNumber: null,
    requestId: null,
    packageId: TEST_PACKAGE_ID,
    status: "pending",
    customerEmail: "checkout@example.com",
    quantity: 2,
    totalCents: 2500,
    currency: "UGX",
  });
  db.packageRecord.state.sellingPriceCents = 9999;
  db.packageRecord.state.currencyCode = "USD";

  const syncResponse = OrderResponseSchema.parse({
    status: true,
    data: {
      order_id: "A-ORDER-1",
      order_reference: "REF-1",
      status: "completed",
      iccid: "8900000000000000001",
      activation_code: "LPA:1$example$activation",
    },
  });
  const airalo = new FakeAiraloClient({ syncResponse });

  const result = await createOrder(
    {
      packageId: TEST_PACKAGE_ID,
      quantity: 1,
      customerEmail: "ignored@example.com",
    },
    {
      prisma: db as unknown as CreateOrderOptions["prisma"],
      airaloClient: airalo as unknown as AiraloClient,
      submissionMode: "sync",
      reservedOrder: {
        orderId: "reserved-order-1",
        packageId: TEST_PACKAGE_ID,
        airaloPackageId: "pkg-test",
        packageTitle: "Test 1GB",
        quantity: 2,
        totalCents: 2500,
        currency: "UGX",
        customerEmail: "checkout@example.com",
      },
    },
  );

  assert.equal(result.orderId, "reserved-order-1");
  assert.equal(airalo.syncPayloads.length, 1);
  assert.equal(airalo.syncPayloads[0]?.quantity, "2");
  assert.equal(airalo.syncPayloads[0]?.description, "2 x Test 1GB");
  assert.equal(airalo.syncPayloads[0]?.to_email, "checkout@example.com");
  assert.equal(db.orders.length, 1);
  assert.equal(db.orders[0]?.totalCents, 2500);
  assert.equal(db.orders[0]?.currency, "UGX");
  assert.equal(db.orders[0]?.customerEmail, "checkout@example.com");
});

test("createOrder does not submit Airalo again for an in-flight reserved checkout order", async () => {
  const db = new FakeOrderDb();
  db.orders.push({
    id: "reserved-order-1",
    orderNumber: null,
    requestId: null,
    packageId: TEST_PACKAGE_ID,
    status: "airalo_submitting",
    customerEmail: "checkout@example.com",
    quantity: 1,
    totalCents: 1250,
    currency: "USD",
  });
  const airalo = new FakeAiraloClient({
    syncResponse: OrderResponseSchema.parse({
      status: true,
      data: {
        order_id: "A-ORDER-1",
        status: "completed",
      },
    }),
  });

  const result = await createOrder(
    {
      packageId: TEST_PACKAGE_ID,
      quantity: 1,
      customerEmail: "checkout@example.com",
    },
    {
      prisma: db as unknown as CreateOrderOptions["prisma"],
      airaloClient: airalo as unknown as AiraloClient,
      submissionMode: "sync",
      reservedOrder: {
        orderId: "reserved-order-1",
        packageId: TEST_PACKAGE_ID,
        airaloPackageId: "pkg-test",
        packageTitle: "Test 1GB",
        quantity: 1,
        totalCents: 1250,
        currency: "USD",
        customerEmail: "checkout@example.com",
      },
    },
  );

  assert.equal(result.orderId, "reserved-order-1");
  assert.equal(airalo.syncPayloads.length, 0);
  assert.equal(db.orders[0]?.status, "airalo_submitting");
});

test("createInstallationPayload maps Get eSIM response fields", () => {
  const payload = JSON.parse(
    createInstallationPayload(null, {
      id: 11028,
      created_at: "2023-02-27 08:30:14",
      iccid: "8944465400000267221",
      lpa: "lpa.airalo.com",
      matching_id: "TEST",
      qrcode: "LPA:1$lpa.airalo.com$TEST",
      qrcode_url: "https://sandbox.airalo.com/qr?id=13282",
      direct_apple_installation_url:
        "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$lpa.airalo.com$TEST",
      apn_type: "automatic",
      apn_value: "globaldata",
      is_roaming: true,
      confirmation_code: "5751",
      brand_settings_name: "Simplify",
      recycled: true,
      recycled_at: "2025-05-05 10:52:39",
      simable: {
        id: 9647,
        package_id: "kallur-digital-7days-1gb",
        package: "Kallur Digital-1 GB - 7 Days",
        data: "1 GB",
        validity: "7",
        status: { name: "Completed", slug: "completed" },
        sharing: {
          link: "https://esims.cloud/simplify/a4g5ht",
          access_code: "4812",
        },
      },
    }),
  ) as Record<string, unknown>;

  assert.equal(payload.iccid, "8944465400000267221");
  assert.equal(payload.source, "sim");
  assert.equal(payload.activationCode, "TEST");
  assert.equal(payload.qrCodeData, "LPA:1$lpa.airalo.com$TEST");
  assert.equal(payload.qrCodeUrl, "https://sandbox.airalo.com/qr?id=13282");
  assert.equal(payload.directAppleUrl?.toString().startsWith("https://esimsetup.apple.com"), true);
  assert.equal(payload.apn, "globaldata");
  assert.equal(payload.apnType, "automatic");
  assert.equal(payload.isRoaming, true);
  assert.equal(payload.recycled, true);
  assert.deepEqual(payload.share, {
    link: "https://esims.cloud/simplify/a4g5ht",
    accessCode: "4812",
  });
});

test("ensureOrderInstallation hydrates an existing ICCID through Get eSIM", async () => {
  const db = new FakeOrderDb();
  db.orders.push({
    id: "order-1",
    orderNumber: null,
    requestId: "req_123",
    packageId: TEST_PACKAGE_ID,
    status: "pending",
    customerEmail: "customer@example.com",
    quantity: 1,
    totalCents: 1250,
    currency: "USD",
  });
  db.profiles.push({
    id: "profile-1",
    iccid: "8944465400000267221",
    status: "pending",
    activationCode: null,
    orderId: "order-1",
  });

  const simResponse: SimResponse = {
    data: {
      id: 11028,
      created_at: "2023-02-27 08:30:14",
      iccid: "8944465400000267221",
      lpa: "lpa.airalo.com",
      matching_id: "TEST",
      qrcode: "LPA:1$lpa.airalo.com$TEST",
      qrcode_url: "https://sandbox.airalo.com/qr?id=13282",
      direct_apple_installation_url:
        "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$lpa.airalo.com$TEST",
      apn_type: "automatic",
      apn_value: "globaldata",
      is_roaming: true,
      recycled: false,
      recycled_at: null,
      simable: {
        id: 9647,
        status: { name: "Completed", slug: "completed" },
        sharing: {
          link: "https://esims.cloud/simplify/a4g5ht",
          access_code: "4812",
        },
      },
    },
    meta: { message: "success" },
  };
  const airalo = new FakeAiraloClient({ simResponse });

  const order = await ensureOrderInstallation("order-1", {
    prisma: db as unknown as CreateOrderOptions["prisma"],
    airaloClient: airalo as unknown as AiraloClient,
  });

  assert.equal(airalo.orderLookups.length, 0);
  assert.deepEqual(airalo.simLookups, [
    {
      iccid: "8944465400000267221",
      include: ["order", "order.status", "share"],
    },
  ]);
  assert.equal(db.orders[0]?.status, "completed");
  assert.equal(db.profiles[0]?.activationCode, "TEST");
  assert.equal(db.snapshots[0]?.source, "sim");

  const payload = JSON.parse(
    String(order?.installation?.payload),
  ) as Record<string, unknown>;
  assert.equal(payload.source, "sim");
  assert.equal(payload.qrCodeUrl, "https://sandbox.airalo.com/qr?id=13282");
  assert.equal(payload.directAppleUrl?.toString().startsWith("https://esimsetup.apple.com"), true);
  assert.equal(payload.apn, "globaldata");
  assert.equal(payload.recycled, false);
});

test("createOrder maps documented Airalo 422 validation responses", async (t) => {
  const cases: Array<{
    name: string;
    body: unknown;
    expectedMessage: string;
    expectedPath: string;
  }> = [
    {
      name: "invalid package",
      body: {
        data: { package_id: ["The selected package is invalid."] },
        meta: { message: "the parameter is invalid" },
      },
      expectedMessage: "The selected package is invalid.",
      expectedPath: "packageId",
    },
    {
      name: "quantity unavailable",
      body: {
        data: {
          quantity: ["SIM quantity is not available. Available quantity: 2."],
        },
        meta: { message: "the parameter is invalid" },
      },
      expectedMessage: "SIM quantity is not available. Available quantity: 2.",
      expectedPath: "quantity",
    },
    {
      name: "quantity greater than Airalo max",
      body: {
        data: { quantity: ["The quantity may not be greater than 50."] },
        meta: { message: "the parameter is invalid" },
      },
      expectedMessage: "The quantity may not be greater than 50.",
      expectedPath: "quantity",
    },
    {
      name: "missing brand",
      body: {
        data: { brand_settings_name: ["Brand settings name doesn't exist."] },
        meta: { message: "the parameter is invalid" },
      },
      expectedMessage: "Brand settings name doesn't exist.",
      expectedPath: "brandSettingsName",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const db = new FakeOrderDb();
      const airalo = new FakeAiraloClient({
        syncError: new AiraloError("Airalo rejected the request.", {
          status: 422,
          statusText: "Unprocessable Entity",
          body: item.body,
        }),
      });

      await assert.rejects(
        () =>
          createTestOrder(
            { quantity: 1 },
            {
              db,
              airalo,
              submissionMode: "sync",
            },
          ),
        (error: unknown) => {
          assert.ok(error instanceof OrderValidationError);
          assert.equal(error.status, 422);
          assert.equal(error.message, item.expectedMessage);
          assert.equal(error.issues[0]?.path[0], item.expectedPath);
          return true;
        },
      );
    });
  }
});
