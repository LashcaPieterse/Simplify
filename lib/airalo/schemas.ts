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
      token_type: z.string().optional(),
    })
    .passthrough(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type TokenPayload = TokenResponse["data"];

export const PackageSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    sku: z.string().optional(),
    name: z.string(),
    destination: z.string(),
    destination_name: z.string().optional(),
    region: z.string().optional(),
    currency: z.string(),
    price: z.coerce.number(),
    validity: z.number().int().positive().optional(),
    data_amount: z.string().optional(),
    is_unlimited: z.boolean().optional(),
  })
  .passthrough();

export type Package = z.infer<typeof PackageSchema>;

export const PackagesResponseSchema = BaseResponseSchema.extend({
  data: z.array(PackageSchema),
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
