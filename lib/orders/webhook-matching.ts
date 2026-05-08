import type { Prisma } from "@prisma/client";
import type { WebhookPayload } from "../airalo/schemas";

type WebhookData = WebhookPayload["data"];

function normalizeWebhookString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  const requestId = resolveWebhookRequestId(data);

  if (requestId) {
    clauses.push({ requestId });
  }

  return clauses;
}
