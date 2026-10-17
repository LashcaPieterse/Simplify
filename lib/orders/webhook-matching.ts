import type { Prisma } from "@prisma/client";
import type { WebhookPayload } from "../airalo/schemas";

type WebhookData = WebhookPayload["data"];

type WebhookOrder = Prisma.EsimOrderGetPayload<{
  include: { profiles: true; package: true };
}>;

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

export function assertWebhookOrderIdentity(
  order: Pick<WebhookOrder, "id" | "orderNumber" | "requestId" | "quantity" | "profiles"> & {
    package: { airaloPackageId: string };
  },
  data: WebhookData,
): void {
  const localId = resolveWebhookLocalOrderId(data);
  const requestId = resolveWebhookRequestId(data);
  const packageId = resolveWebhookPackageExternalId(data);
  if (
    (localId && localId !== order.id) ||
    (order.orderNumber && order.orderNumber !== data.order_id) ||
    (requestId && order.requestId && requestId !== order.requestId) ||
    (packageId && packageId !== order.package.airaloPackageId) ||
    order.quantity !== 1 ||
    (data.quantity !== undefined && Number(data.quantity) !== order.quantity) ||
    (Array.isArray(data.sims) && data.sims.length > 1) ||
    (data.iccid && order.profiles.length > 0 &&
      !order.profiles.some((profile) => profile.iccid === data.iccid))
  ) {
    throw new Error("Supplier order identity conflicts with the local purchase.");
  }
}

export async function findOrderForWebhook(
  tx: Pick<Prisma.TransactionClient, "esimOrder">,
  payload: WebhookPayload,
): Promise<{ order: WebhookOrder | null; matchMethod: "direct" | null }> {
  // A package is shared by many customers and cannot identify a purchase.
  // Read two candidates so conflicting identifiers never select an arbitrary row.
  const candidates = await tx.esimOrder.findMany({
    where: { OR: buildWebhookOrderClauses(payload.data) },
    include: { profiles: true, package: true },
    take: 2,
  });
  if (candidates.length > 1) {
    throw new Error("Supplier identifiers match different local purchases.");
  }
  const order = candidates[0] ?? null;
  if (order) assertWebhookOrderIdentity(order, payload.data);
  return { order, matchMethod: order ? "direct" : null };
}
