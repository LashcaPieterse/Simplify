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

const MultiCurrencyPricesSchema = z
  .record(MultiCurrencyPriceSchema)
  .optional();

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

export const PackagesResponseSchema = BaseResponseSchema.extend({
  data: z.union([PackagesArraySchema, PackagesIndexSchema]),
  links: PaginationLinksSchema.optional(),
  meta: PaginationMetaSchema.optional(),
});

export type PackagesResponse = z.infer<typeof PackagesResponseSchema>;

export const OrderResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      order_id: z.union([z.string(), z.number()]).transform(String),
      package_id: z.union([z.string(), z.number()]).transform(String).optional(),
      status: z.string(),
      qr_code: z.string().url().optional(),
      activation_code: z.string().optional(),
      iccid: z.string().optional(),
      esim: z.string().optional(),
      order_reference: z.string().optional(),
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

export type SubmitOrderAsyncResponse = z.infer<typeof SubmitOrderAsyncResponseSchema>;
export type SubmitOrderAsyncAck = SubmitOrderAsyncResponse["data"];

const UsageMetricSchema = z
  .object({
    unit: z.string().optional(),
    total: z.coerce.number().optional(),
    used: z.coerce.number().optional(),
    remaining: z.coerce.number().optional(),
  })
  .passthrough();

export const UsageResponseSchema = BaseResponseSchema.extend({
  data: z
    .object({
      iccid: z.string(),
      data: UsageMetricSchema.optional(),
      voice: UsageMetricSchema.optional(),
      sms: UsageMetricSchema.optional(),
      last_updated_at: z.string().datetime().optional(),
    })
    .passthrough(),
});

export type UsageResponse = z.infer<typeof UsageResponseSchema>;
export type Usage = UsageResponse["data"];

export const WebhookPayloadSchema = z
  .object({
    event: z.string(),
    timestamp: z.string().datetime().optional(),
    data: z
      .object({
        order_id: z.union([z.string(), z.number()]).transform(String),
        status: z.string(),
        previous_status: z.string().optional(),
        package_id: z.union([z.string(), z.number()]).transform(String).optional(),
        iccid: z.string().optional(),
        reference: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

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

export const SimInstallationInstructionsResponseSchema = BaseResponseSchema.extend({
  data: z.object({
    instructions: InstallationInstructionsSchema,
  }),
});

export type PlatformInstallationInstructions = z.infer<
  typeof PlatformInstallationInstructionsSchema
>;
export type InstallationInstructions = z.infer<typeof InstallationInstructionsSchema>;
export type SimInstallationInstructionsResponse = z.infer<
  typeof SimInstallationInstructionsResponseSchema
>;
export type InstallationStepDictionary = z.infer<typeof InstallationStepsSchema>;

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
