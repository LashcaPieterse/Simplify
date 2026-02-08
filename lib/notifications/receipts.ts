import type { PrismaClient } from "@prisma/client";

import prismaClient from "@/lib/db/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { sendEmail } from "@/lib/notifications/email";

const DEFAULT_FROM = "receipts@simplify.africa";

export type ReceiptSendResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

type SendReceiptOptions = {
  prisma?: PrismaClient;
  baseUrl?: string;
};

function resolveBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function buildReceiptEmail(options: {
  recipientName: string | null;
  orderReference: string;
  planName: string;
  destination: string | null;
  amountLabel: string;
  status: string;
  purchasedAt: string;
  orderLink: string;
}) {
  const greeting = options.recipientName ? `Hi ${options.recipientName},` : "Hi there,";
  const destinationLine = options.destination ? `Destination: ${options.destination}` : "";

  const textLines = [
    greeting,
    "",
    "Thanks for your Simplify purchase. Here is your receipt:",
    `Order: ${options.orderReference}`,
    `Plan: ${options.planName}`,
    destinationLine,
    `Status: ${options.status}`,
    `Amount: ${options.amountLabel}`,
    `Date: ${options.purchasedAt}`,
    "",
    `View your order: ${options.orderLink}`,
    "",
    "Need help? Email support@simplify.africa.",
  ].filter(Boolean);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <p>${greeting}</p>
      <p>Thanks for your Simplify purchase. Here is your receipt:</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Order</td><td style="padding: 6px 0; font-weight: 600;">${options.orderReference}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Plan</td><td style="padding: 6px 0; font-weight: 600;">${options.planName}</td></tr>
        ${
          options.destination
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Destination</td><td style="padding: 6px 0; font-weight: 600;">${options.destination}</td></tr>`
            : ""
        }
        <tr><td style="padding: 6px 0; color: #64748b;">Status</td><td style="padding: 6px 0; font-weight: 600;">${options.status}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Amount</td><td style="padding: 6px 0; font-weight: 600;">${options.amountLabel}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Date</td><td style="padding: 6px 0; font-weight: 600;">${options.purchasedAt}</td></tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${options.orderLink}" style="color: #0f766e; font-weight: 600; text-decoration: underline;">View your order</a>
      </p>
      <p style="color: #64748b; font-size: 13px;">Need help? Email support@simplify.africa.</p>
    </div>
  `;

  return {
    subject: "Your Simplify eSIM receipt",
    text: textLines.join("\n"),
    html,
  };
}

export async function sendOrderReceipt(
  orderId: string,
  options: SendReceiptOptions = {},
): Promise<ReceiptSendResult> {
  const db = options.prisma ?? prismaClient;

  const order = await db.esimOrder.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true } },
      payment: true,
    },
  });

  if (!order) {
    return { sent: false, skipped: true, reason: "order_not_found" };
  }

  if (order.receiptSentAt) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  const receiptEmail = order.customerEmail ?? order.user?.email ?? null;

  if (!receiptEmail) {
    return { sent: false, skipped: true, reason: "missing_email" };
  }

  const now = new Date();
  const claimed = await db.esimOrder.updateMany({
    where: { id: orderId, receiptSentAt: null },
    data: { receiptSentAt: now, receiptEmail },
  });

  if (claimed.count === 0) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  const pkg = await db.package.findFirst({
    where: { OR: [{ id: order.packageId }, { externalId: order.packageId }] },
    include: { country: true },
  });

  const amountCents = order.totalCents ?? order.payment?.amountCents ?? null;
  const currency = order.currency ?? order.payment?.currency ?? "USD";
  const amountLabel = amountCents === null ? currency : formatCurrency(amountCents, currency);
  const orderReference = order.orderNumber ?? order.requestId ?? order.id;
  const purchasedAt = formatDate(order.createdAt);
  const orderLink = `${options.baseUrl ?? resolveBaseUrl()}/orders/${order.id}`;

  const { subject, text, html } = buildReceiptEmail({
    recipientName: order.user?.name ?? null,
    orderReference,
    planName: pkg?.name ?? "Simplify eSIM plan",
    destination: pkg?.country?.name ?? null,
    amountLabel,
    status: order.status,
    purchasedAt,
    orderLink,
  });

  try {
    const result = await sendEmail({
      to: receiptEmail,
      subject,
      text,
      html,
      from: process.env.RECEIPT_EMAIL_FROM ?? DEFAULT_FROM,
    });

    if (result.skipped) {
      await db.esimOrder.update({
        where: { id: orderId },
        data: { receiptSentAt: null, receiptEmail: null },
      });
      return { sent: false, skipped: true, reason: "email_disabled" };
    }

    return { sent: true, skipped: false };
  } catch (error) {
    await db.esimOrder.update({
      where: { id: orderId },
      data: { receiptSentAt: null, receiptEmail: null },
    });
    throw error;
  }
}
