import type { Prisma, PrismaClient } from "@prisma/client";
type Db = PrismaClient | Prisma.TransactionClient;

export async function orderDisposition(db: Db, id: string) {
  const order = await db.esimOrder.findUnique({ where: { id }, include: { checkout: true, saleCheckout: true } });
  const sale = order?.saleCheckout ?? order?.checkout;
  return { order, sale, blocked: Boolean(sale && (sale.fulfillmentHold || (sale.activeOrderId && sale.activeOrderId !== id))), permanent: Boolean(sale && (sale.fulfillmentHold === "refunded" || (sale.activeOrderId && sale.activeOrderId !== id))) };
}

export async function assertCheckoutOpen(db: Db, id: string) {
  const sale = await db.checkoutSession.findUnique({ where: { id } });
  if (!sale) throw new Error("Checkout not found.");
  if (sale.fulfillmentHold || (sale.activeOrderId && sale.activeOrderId !== sale.orderId)) throw new Error("Fulfillment is held or has a replacement. Reconcile the active delivery.");
  return sale;
}
