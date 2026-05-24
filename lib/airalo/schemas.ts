import { z } from "zod";

const BaseResponseSchema = z
  .object({
    status: z.boolean().optional(),
    status_code: z.number().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const TokenResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      access_token: z.string(),
      expires_in: z.number().positive(),
      token_type: z.string(),
    })
    .passthrough(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type TokenPayload = TokenResponse["data"];

const MultiCurrencyPriceSchema = z
  .object({
    amount: z.coerce.number().optional(),
    value: z.coerce.number().optional(),
    price: z.coerce.number().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const MultiCurrencyPricesSchema = z.record(MultiCurrencyPriceSchema).optional();

const CurrencyAmountMapSchema = z.record(z.coerce.number()).optional();

const ListPackagesPackageSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    price: z.coerce.number().optional(),
    day: z.coerce.number().optional(),
    data: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    is_unlimited: z.boolean().optional(),
    prices: z
      .object({
        net_price: CurrencyAmountMapSchema,
        recommended_retail_price: CurrencyAmountMapSchema,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const ListPackagesOperatorSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    operator_code: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    packages: z.array(ListPackagesPackageSchema).optional(),
  })
  .passthrough();

export const ListPackagesCountrySchema = z
  .object({
    country_code: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    region: z.string().nullable().optional(),
    image: z
      .object({
        url: z.string().nullable().optional(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    operators: z.array(ListPackagesOperatorSchema).optional(),
  })
  .passthrough();

export const ListPackagesDataSchema = z.union([
  z.array(ListPackagesCountrySchema),
  z.record(ListPackagesCountrySchema),
]);

const PricingSchema = z
  .object({
    discount_percentage: z.coerce.number().optional(),
    model: z.string().optional(),
  })
  .passthrough();

export const PackageSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    sku: z.string().optional(),
    name: z.string(),
    destination: z.string(),
    destination_name: z.string().optional(),
    region: z.string().optional(),
    currency: z.string().optional(),
    price: z.coerce.number().optional(),
    validity: z.number().int().positive().optional(),
    data_amount: z.string().optional(),
    is_unlimited: z.boolean().optional(),
    status: z.string().optional(),
    sim_type: z.string().optional(),
    is_rechargeable: z.boolean().optional(),
    network_types: z.array(z.string()).optional(),
    voice: z.coerce.number().optional(),
    sms: z.coerce.number().optional(),
    apn: z.string().optional(),
    qr_code_data: z.string().optional(),
    qr_code_url: z.string().url().optional(),
    smdp_address: z.string().optional(),
    iccid: z.string().optional(),
    activation_code: z.string().optional(),
    top_up_parent_package_id: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
    net_prices: MultiCurrencyPricesSchema,
    recommended_retail_prices: MultiCurrencyPricesSchema,
  })
  .passthrough();

export type Package = z.infer<typeof PackageSchema>;

const PaginationLinksSchema = z
  .object({
    first: z.string().optional(),
    last: z.string().optional(),
    prev: z.string().nullable().optional(),
    next: z.string().nullable().optional(),
  })
  .passthrough();

const PaginationMetaSchema = z
  .object({
    message: z.string().optional(),
    current_page: z.coerce.number(),
    from: z.coerce.number().nullable().optional(),
    last_page: z.coerce.number(),
    path: z.string(),
    per_page: z.coerce.number(),
    to: z.coerce.number().nullable().optional(),
    total: z.coerce.number(),
  })
  .passthrough();

const PackagesArraySchema = z.array(PackageSchema);
const PackagesIndexSchema = z.record(PackagesArraySchema);
export const LegacyPackagesDataSchema = z.union([
  PackagesArraySchema,
  PackagesIndexSchema,
]);

export const PackagesResponseSchema = BaseResponseSchema.extend({
  data: LegacyPackagesDataSchema,
  links: PaginationLinksSchema.optional(),
  meta: PaginationMetaSchema.optional(),
});

export type PackagesResponse = z.infer<typeof PackagesResponseSchema>;

const TopUpPricingSchema = z
  .object({
    model: z.string(),
    discount_percentage: z.coerce.number(),
  })
  .passthrough();

export const TopUpPackageSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    type: z.string(),
    price: z.coerce.number(),
    amount: z.coerce.number(),
    day: z.coerce.number(),
    is_unlimited: z.boolean(),
    title: z.string(),
    data: z.string(),
    short_info: z.string().nullable().optional(),
    voice: z.coerce.number(),
    text: z.coerce.number(),
    net_price: z.coerce.number().nullable().optional(),
  })
  .passthrough();

export const TopUpPackagesResponseSchema = BaseResponseSchema.extend({
  pricing: TopUpPricingSchema.optional(),
  data: z.array(TopUpPackageSchema).default([]),
});

export type TopUpPackagesResponse = z.infer<typeof TopUpPackagesResponseSchema>;
export type AiraloTopUpPackage = z.infer<typeof TopUpPackageSchema>;

export const ListPackagesResponseSchema = BaseResponseSchema.extend({
  data: ListPackagesDataSchema,
  links: PaginationLinksSchema.optional(),
  meta: PaginationMetaSchema.optional(),
  pricing: PricingSchema.optional(),
});

export type ListPackagesResponse = z.infer<typeof ListPackagesResponseSchema>;
export type ListPackagesData = z.infer<typeof ListPackagesDataSchema>;
export type ListPackagesCountry = z.infer<typeof ListPackagesCountrySchema>;

export const OrderResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      // Airalo has shipped multiple response shapes; accept both the classic webhook-style payload
      // and the richer synchronous /orders response with SIM details.
      order_id: z
        .union([z.string(), z.number(), z.null()])
        .transform((value) => (value == null ? undefined : String(value)))
        .optional(),
      id: z
        .union([z.string(), z.number(), z.null()])
        .transform((value) => (value == null ? undefined : String(value)))
        .optional(),
      code: z
        .union([z.string(), z.number(), z.null()])
        .transform((value) => (value == null ? undefined : String(value)))
        .optional(),
      package_id: z
        .union([z.string(), z.number(), z.null()])
        .transform((value) => (value == null ? undefined : String(value)))
        .optional(),
      status: z.string().nullable().optional(),
      qr_code: z.string().nullable().optional(),
      qr_code_data: z.string().nullable().optional(),
      smdp_address: z.string().nullable().optional(),
      activation_code: z.string().nullable().optional(),
      iccid: z.string().nullable().optional(),
      esim: z.string().nullable().optional(),
      order_reference: z.string().nullable().optional(),
      top_up_parent_package_id: z
        .union([z.string(), z.number(), z.null()])
        .transform((value) => (value == null ? undefined : String(value)))
        .optional(),
      manual_installation: z.string().nullable().optional(),
      qrcode_installation: z.string().nullable().optional(),
      direct_apple_installation_url: z.string().nullable().optional(),
      apn: z.string().nullable().optional(),
      apn_type: z.string().nullable().optional(),
      apn_value: z.string().nullable().optional(),
      net_price: z.union([z.string(), z.number(), z.null()]).optional(),
      voice: z.union([z.string(), z.number(), z.null()]).optional(),
      text: z.union([z.string(), z.number(), z.null()]).optional(),
      sims: z
        .array(
          z
            .object({
              iccid: z.string().nullable().optional(),
              qrcode: z.string().nullable().optional(),
              qrcode_url: z.string().nullable().optional(),
              direct_apple_installation_url: z.string().nullable().optional(),
              lpa: z.string().nullable().optional(),
              matching_id: z.string().nullable().optional(),
              activation_code: z.string().nullable().optional(),
              apn: z.string().nullable().optional(),
              apn_type: z.string().nullable().optional(),
              apn_value: z.string().nullable().optional(),
              net_price: z.union([z.string(), z.number(), z.null()]).optional(),
              voice: z.union([z.string(), z.number(), z.null()]).optional(),
              text: z.union([z.string(), z.number(), z.null()]).optional(),
              is_roaming: z.boolean().nullable().optional(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .passthrough(),
});

export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type Order = OrderResponse["data"];

export const SubmitOrderAsyncResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      request_id: z.string(),
      accepted_at: z.string(),
    })
    .passthrough(),
  meta: z
    .object({
      message: z.string(),
    })
    .passthrough(),
});

export type SubmitOrderAsyncResponse = z.infer<
  typeof SubmitOrderAsyncResponseSchema
>;
export type SubmitOrderAsyncAck = SubmitOrderAsyncResponse["data"];

export const UsageResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      remaining: z.coerce.number(),
      total: z.coerce.number(),
      expired_at: z.string().nullable(),
      is_unlimited: z.boolean().nullable(),
      status: z.string(),
      remaining_voice: z.coerce.number(),
      remaining_text: z.coerce.number(),
      total_voice: z.coerce.number(),
      total_text: z.coerce.number(),
    })
    .passthrough(),
});

export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type Usage = UsageResponse["data"];

function normalizeWebhookOrderId(data: Record<string, unknown>): string | null {
  const value = data.order_id ?? data.id ?? data.code;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeWebhookStatus(data: Record<string, unknown>): string {
  const value = data.status;
  return typeof value === "string" && value.trim() ? value.trim() : "completed";
}

function normalizeWebhookIccid(data: Record<string, unknown>): string | undefined {
  const value = data.iccid;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const sims = data.sims;
  if (Array.isArray(sims)) {
    const firstSim = sims.find(
      (sim): sim is Record<string, unknown> =>
        Boolean(sim) && typeof sim === "object" && !Array.isArray(sim),
    );
    const simIccid = firstSim?.iccid;
    if (typeof simIccid === "string" && simIccid.trim()) {
      return simIccid.trim();
    }
  }

  return undefined;
}

function normalizeWebhookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return payload;
  }

  const dataRecord = data as Record<string, unknown>;
  if (
    typeof record.event === "string" &&
    "order_id" in dataRecord &&
    typeof dataRecord.status === "string"
  ) {
    return payload;
  }

  const orderId = normalizeWebhookOrderId(dataRecord);
  if (!orderId) {
    return payload;
  }

  const iccid = normalizeWebhookIccid(dataRecord);
  return {
    ...record,
    event: typeof record.event === "string" ? record.event : "order.processed",
    data: {
      ...dataRecord,
      order_id: orderId,
      status: normalizeWebhookStatus(dataRecord),
      ...(typeof dataRecord.order_reference === "string" &&
      !dataRecord.reference
        ? { reference: dataRecord.order_reference }
        : {}),
      ...(iccid ? { iccid } : {}),
    },
  };
}

export const WebhookPayloadSchema = z.preprocess(
  normalizeWebhookPayload,
  z.object({
    event: z.string(),
    timestamp: z.string().datetime().optional(),
    data: z
      .object({
        order_id: z.union([z.string(), z.number()]).transform(String),
        status: z.string(),
        previous_status: z.string().optional(),
        package_id: z
          .union([z.string(), z.number()])
          .transform(String)
          .optional(),
        iccid: z.string().optional(),
        reference: z.string().optional(),
        request_id: z.string().optional(),
        requestId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .passthrough(),
  })
    .passthrough(),
);

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

const InstallationStepsSchema = z.record(z.string(), z.string()).catch({});

const InstallationViaQrCodeSchema = z
  .object({
    steps: InstallationStepsSchema.optional(),
    qr_code_data: z.string().nullable().optional(),
    qr_code_url: z.string().nullable().optional(),
    direct_apple_installation_url: z.string().nullable().optional(),
  })
  .passthrough();

const InstallationManualSchema = z
  .object({
    steps: InstallationStepsSchema.optional(),
    smdp_address_and_activation_code: z.string().nullable().optional(),
  })
  .passthrough();

const NetworkSetupSchema = z
  .object({
    steps: InstallationStepsSchema.optional(),
    apn_type: z.string().nullable().optional(),
    apn_value: z.string().nullable().optional(),
    is_roaming: z.boolean().nullable().optional(),
  })
  .passthrough();

export const PlatformInstallationInstructionsSchema = z
  .object({
    model: z.string().nullable().optional(),
    version: z.string().nullable().optional(),
    installation_via_qr_code: InstallationViaQrCodeSchema.nullable().optional(),
    installation_manual: InstallationManualSchema.nullable().optional(),
    network_setup: NetworkSetupSchema.nullable().optional(),
  })
  .passthrough();

export const InstallationInstructionsSchema = z
  .object({
    language: z.string(),
    ios: z.array(PlatformInstallationInstructionsSchema).default([]),
    android: z.array(PlatformInstallationInstructionsSchema).default([]),
  })
  .passthrough();

export const SimInstallationInstructionsResponseSchema =
  BaseResponseSchema.extend({
    data: z.object({
      instructions: InstallationInstructionsSchema,
    }),
  });

export type PlatformInstallationInstructions = z.infer<
  typeof PlatformInstallationInstructionsSchema
>;
export type InstallationInstructions = z.infer<
  typeof InstallationInstructionsSchema
>;
export type SimInstallationInstructionsResponse = z.infer<
  typeof SimInstallationInstructionsResponseSchema
>;
export type SimInstallationInstructionsPayload =
  SimInstallationInstructionsResponse["data"];
export type InstallationStepDictionary = z.infer<
  typeof InstallationStepsSchema
>;

const SimStatusSchema = z
  .object({
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
  })
  .passthrough();

const SimUserSchema = z
  .object({
    id: z.coerce.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    mobile: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country_id: z.coerce.number().nullable().optional(),
    company: z.string().nullable().optional(),
  })
  .passthrough();

const SimSharingSchema = z
  .object({
    link: z.string().nullable().optional(),
    access_code: z.string().nullable().optional(),
  })
  .passthrough();

const InstallationGuidesSchema = z.record(z.string()).optional();

const SimSimableSchema = z
  .object({
    id: z.coerce.number(),
    created_at: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    package_id: z.string().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    package: z.string().nullable().optional(),
    esim_type: z.string().nullable().optional(),
    validity: z.string().nullable().optional(),
    price: z.string().nullable().optional(),
    data: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    manual_installation: z.string().nullable().optional(),
    qrcode_installation: z.string().nullable().optional(),
    installation_guides: InstallationGuidesSchema.nullable().optional(),
    status: SimStatusSchema.nullable().optional(),
    user: SimUserSchema.nullable().optional(),
    sharing: SimSharingSchema.nullable().optional(),
  })
  .passthrough();

const SimDataSchema = z
  .object({
    id: z.coerce.number(),
    created_at: z.string(),
    iccid: z.string(),
    lpa: z.string().nullable().optional(),
    imsis: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    matching_id: z.string().nullable().optional(),
    qrcode: z.string().nullable().optional(),
    qrcode_url: z.string().nullable().optional(),
    direct_apple_installation_url: z.string().nullable().optional(),
    voucher_code: z.string().nullable().optional(),
    airalo_code: z.string().nullable().optional(),
    apn_type: z.string().nullable().optional(),
    apn_value: z.string().nullable().optional(),
    is_roaming: z.boolean().nullable().optional(),
    confirmation_code: z.string().nullable().optional(),
    order: z.unknown().nullable().optional(),
    brand_settings_name: z.string().nullable().optional(),
    recycled: z.boolean().optional(),
    recycled_at: z.string().nullable().optional(),
    simable: SimSimableSchema.nullable().optional(),
  })
  .passthrough();

export const SimResponseSchema = BaseResponseSchema.extend({
  data: SimDataSchema,
  meta: z.object({ message: z.string().optional() }).passthrough().optional(),
});

export type SimResponse = z.infer<typeof SimResponseSchema>;
export type Sim = z.infer<typeof SimDataSchema>;
export type Simable = z.infer<typeof SimSimableSchema>;
