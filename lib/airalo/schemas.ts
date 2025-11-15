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
