import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";
import { parseInstallationPayloadJson } from "../orders/installation";

const deliveryEvidence = {
  status: true, orderNumber: true,
  profiles: { select: { activationCode: true } },
  installation: { select: { payload: true } },
} satisfies Prisma.EsimOrderSelect;

/** Current fulfilment of the approval cohort, once per sale, including non-affiliates. */
export async function countFulfilledSales(db: PrismaClient, input: { from: Date; currency: string; mode: "live" | "test" }) {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const sales = await db.checkoutSession.findMany({
      where: { currency: input.currency, payments: { some: { status: "approved", dpoMode: input.mode, approvedAt: { gte: input.from } } } },
      select: { id: true, intent: true, activeOrder: { select: deliveryEvidence }, order: { select: deliveryEvidence } },
      orderBy: { id: "asc" }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const sale of sales) {
      const order = sale.activeOrder ?? sale.order;
      if (order?.status !== "completed" || !order.orderNumber) continue;
      if (sale.intent === "top-up" || order.profiles.length && resolveReceiptDeliveryDetails(parseInstallationPayloadJson(order.installation?.payload), order.profiles[0]?.activationCode).ready) count++;
    }
    if (sales.length < 500) return count;
    cursor = sales[sales.length - 1].id;
  }
}
