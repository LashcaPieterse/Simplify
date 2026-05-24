import type { Prisma } from "@prisma/client";
import type { WebhookPayload } from "../airalo/schemas";

type WebhookData = WebhookPayload["data"];

function normalizeWebhookString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveWebhookLocalOrderId(data: WebhookData): string | null {
  const description = normalizeWebhookString(
    (data as Record<string, unknown>).description,
  );
  if (!description) {
    return null;
  }

  const match = description.match(/\bsimplify_order_id:([a-z0-9_-]+)\b/i);
  return match?.[1] ?? null;
}

export function resolveWebhookPackageExternalId(data: WebhookData): string | null {
  return normalizeWebhookString((data as Record<string, unknown>).package_id);
}

export function resolveWebhookRequestId(data: WebhookData): string | null {
  const record = data as Record<string, unknown>;
  return (
    normalizeWebhookString(record.reference) ??
    normalizeWebhookString(record.request_id) ??
    normalizeWebhookString(record.requestId)
  );
}

export function buildWebhookOrderClauses(
  data: WebhookData,
): Prisma.EsimOrderWhereInput[] {
  const clauses: Prisma.EsimOrderWhereInput[] = [
    { orderNumber: data.order_id },
  ];
  const localOrderId = resolveWebhookLocalOrderId(data);
  const requestId = resolveWebhookRequestId(data);

  if (localOrderId) {
    clauses.push({ id: localOrderId });
  }

  if (requestId) {
    clauses.push({ requestId });
  }

  return clauses;
}
