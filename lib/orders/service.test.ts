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
  type SubmitOrderAsyncResponse,
} from "../airalo/schemas";
import {
  OrderValidationError,
  createOrder,
  type CreateOrderInput,
  type CreateOrderOptions,
} from "./service";

const TEST_PACKAGE_ID = "00000000-0000-0000-0000-000000000001";

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
  };

  readonly esimProfile = {
    upsert: async ({
      create,
      update,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
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
      create,
      update,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
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

  constructor(
    private readonly options: {
      asyncResponse?: SubmitOrderAsyncResponse;
      syncResponse?: OrderResponse;
      syncError?: Error;
      asyncError?: Error;
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
  assert.equal(airalo.asyncPayloads[0]?.to_email, "customer@example.com");
  assert.deepEqual(airalo.asyncPayloads[0]?.["sharing_option[]"], ["link"]);
  assert.equal(db.orders[0]?.requestId, "req_123");
  assert.equal(result.requestId, "req_123");
  assert.equal(db.snapshots.length, 1);
  assert.equal(db.snapshots[0]?.source, "orders-async");
  assert.equal(db.snapshots[0]?.requestId, "req_123");
  assert.deepEqual(db.snapshots[0]?.rawPayloadJson, asyncResponse);
});

test("createOrder stores rich /orders response data, APN, and raw snapshot", async () => {
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
  assert.equal(db.snapshots[0]?.orderNumber, "583747");

  const installationPayload = JSON.parse(
    String(db.installationPayloads[0]?.payload),
  ) as Record<string, unknown>;
  assert.equal(installationPayload.orderId, "583747");
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
