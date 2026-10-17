import type { PrismaClient } from "@prisma/client";

import { findPackageDisplayByIdentifier } from "@/lib/catalog/package-resolver";
import prismaClient from "@/lib/db/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { sendEmail } from "@/lib/notifications/email";
import { normalizeHttpUrl } from "@/lib/http/safe-url";
import {
  canIssueScopedAccessTokens,
  createOrderAccessLink,
} from "@/lib/orders/access";

const DEFAULT_FROM = "receipts@sim.africa";

export type ReceiptSendResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

type SendReceiptOptions = {
  prisma?: PrismaClient;
  baseUrl?: string;
};

type ResolveReceiptBaseUrlOptions = {
  baseUrl?: string | null;
  configuredUrl?: string | null;
  vercelUrl?: string | null;
  nodeEnv?: string | null;
};

type ReceiptDeliveryDetails = {
  ready: boolean;
  qrCodeUrl: string | null;
  qrCodeData: string | null;
  directAppleUrl: string | null;
  smdpAddress: string | null;
  activationCode: string | null;
  apn: string | null;
};

function readPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveReceiptDeliveryDetails(
  payload: Record<string, unknown> | null,
  profileActivationCode?: string | null,
): ReceiptDeliveryDetails {
  const qrCodeUrl = normalizeHttpUrl(readPayloadString(payload, "qrCodeUrl"));
  const qrCodeData = readPayloadString(payload, "qrCodeData");
  const directAppleUrl = normalizeHttpUrl(
    readPayloadString(payload, "directAppleUrl"),
  );
  const smdpAddress = readPayloadString(payload, "lpa");
  const activationCode =
    readPayloadString(payload, "activationCode") ??
    readPayloadString(payload, "matchingId") ??
    profileActivationCode?.trim() ??
    null;
  const apn = readPayloadString(payload, "apn");

  return {
    ready: Boolean(
      qrCodeUrl ||
        qrCodeData ||
        directAppleUrl ||
        activationCode,
    ),
    qrCodeUrl,
    qrCodeData,
    directAppleUrl,
    smdpAddress,
    activationCode,
    apn,
  };
}

export function resolveReceiptBaseUrl({
  baseUrl,
  configuredUrl = process.env.NEXT_PUBLIC_APP_URL,
  vercelUrl = process.env.VERCEL_URL,
  nodeEnv = process.env.NODE_ENV,
}: ResolveReceiptBaseUrlOptions = {}): string | null {
  const explicit = baseUrl?.trim();
  const configured = configuredUrl?.trim();
  const vercel = vercelUrl?.trim();
  const candidate = explicit || configured || (vercel ? `https://${vercel}` : null);

  if (candidate) {
    const normalized = normalizeHttpUrl(candidate);
    return normalized ? new URL(normalized).origin : null;
  }

  return nodeEnv === "production" ? null : "http://localhost:3000";
}

function buildOrderLink(orderId: string, baseUrl: string): string {
  if (canIssueScopedAccessTokens()) {
    return createOrderAccessLink(orderId, baseUrl);
  }

  return `${baseUrl}/orders/${orderId}`;
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
  installationGuideUrl: string;
  qrCodeUrl: string | null;
  qrCodeData: string | null;
  directAppleUrl: string | null;
  smdpAddress: string | null;
  activationCode: string | null;
  manualInstallation: string | null;
  activationPolicy: string | null;
  apn: string | null;
  whatsappUrl: string | null;
}) {
  const greeting = options.recipientName ? `Hi ${options.recipientName},` : "Hi there,";
  const destinationLine = options.destination ? `Destination: ${options.destination}` : "";

  const textLines = [
    greeting,
    "",
    "Thanks for your SIM.Africa purchase. Your eSIM order details are below:",
    `Order: ${options.orderReference}`,
    `Plan: ${options.planName}`,
    destinationLine,
    `Status: ${options.status}`,
    `Amount: ${options.amountLabel}`,
    `Date: ${options.purchasedAt}`,
    "",
    `Manage your order: ${options.orderLink}`,
    options.qrCodeUrl ? `QR code: ${options.qrCodeUrl}` : "No QR code URL is currently available. Check the secure order page for the latest fulfilment details.",
    options.qrCodeData ? `QR installation code: ${options.qrCodeData}` : "",
    options.directAppleUrl ? `Direct iPhone installation: ${options.directAppleUrl}` : "",
    options.smdpAddress ? `SM-DP+ address: ${options.smdpAddress}` : "",
    options.activationCode ? `Activation code: ${options.activationCode}` : "",
    options.manualInstallation ? `Manual installation: ${options.manualInstallation}` : "No manual installation values are currently available. Check the secure order page for the latest fulfilment details.",
    options.activationPolicy ? `Activation: ${options.activationPolicy}` : "Activation: Check the package-specific instructions on the secure order page before installing.",
    options.apn ? `APN: ${options.apn}` : "",
    "Installation: Add the eSIM from your phone's mobile-network settings using the supplied QR code or manual values. Keep the plan-specific activation rule in mind.",
    `Detailed installation guide: ${options.installationGuideUrl}`,
    "Important: Do not delete the eSIM prematurely. Many eSIM profiles cannot be installed again with the same QR code.",
    "",
    "Need help? Email support@sim.africa.",
    options.whatsappUrl ? `WhatsApp support: ${options.whatsappUrl}` : "",
  ].filter(Boolean);

  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #153f41; max-width: 620px; margin: 0 auto; padding: 24px;">
      <div style="font-size: 26px; font-weight: 800; letter-spacing: -1px; margin-bottom: 24px;">SIM<span style="color:#e17e16">.</span>Africa</div>
      <p>${safe(greeting)}</p>
      <h1 style="font-size: 24px; margin: 16px 0 8px;">Your eSIM order</h1>
      <p>Thanks for your SIM.Africa purchase. Your order details are below:</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr><td style="padding: 8px 0; color: #64748b;">Order</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.orderReference)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;">Plan</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.planName)}</td></tr>
        ${
          options.destination
            ? `<tr><td style="padding: 8px 0; color: #64748b;">Destination</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.destination)}</td></tr>`
            : ""
        }
        <tr><td style="padding: 8px 0; color: #64748b;">Status</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.status)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;">Amount</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.amountLabel)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;">Date</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.purchasedAt)}</td></tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${safe(options.orderLink)}" style="display:inline-block; background:#1c6b6d; color:#fff; border-radius:999px; padding:12px 20px; font-weight:700; text-decoration:none;">Open secure order &amp; instructions</a>
      </p>
      ${options.qrCodeUrl ? `<div style="margin-top:24px;"><h2 style="font-size:18px;">Install by QR code</h2><img src="${safe(options.qrCodeUrl)}" alt="QR code for installing the eSIM" width="180" height="180" style="display:block;max-width:180px;height:auto;"></div>` : ""}
      ${options.qrCodeData ? `<div style="margin-top:20px;"><h2 style="font-size:18px;">QR installation code</h2><p style="font-family:monospace;white-space:pre-wrap;overflow-wrap:anywhere;">${safe(options.qrCodeData)}</p></div>` : ""}
      ${options.directAppleUrl ? `<p style="margin-top:16px;"><a href="${safe(options.directAppleUrl)}">Install directly on a supported iPhone</a></p>` : ""}
      ${options.smdpAddress || options.activationCode ? `<div style="margin-top:20px;"><h2 style="font-size:18px;">Manual activation values</h2>${options.smdpAddress ? `<p><strong>SM-DP+ address:</strong> <span style="font-family:monospace;overflow-wrap:anywhere;">${safe(options.smdpAddress)}</span></p>` : ""}${options.activationCode ? `<p><strong>Activation code:</strong> <span style="font-family:monospace;overflow-wrap:anywhere;">${safe(options.activationCode)}</span></p>` : ""}</div>` : ""}
      ${options.manualInstallation ? `<div style="margin-top:20px;"><h2 style="font-size:18px;">Manual installation</h2><p style="white-space:pre-wrap;overflow-wrap:anywhere;">${safe(options.manualInstallation)}</p></div>` : ""}
      <div style="margin-top:20px;">
        <h2 style="font-size:18px;">Installation</h2>
        <ol style="padding-left:20px;line-height:1.6;">
          <li>Open the mobile-network or SIM settings on your compatible, carrier-unlocked phone.</li>
          <li>Add an eSIM using the supplied QR code or manual values.</li>
          <li>Follow the package-specific activation and roaming instructions before connecting.</li>
        </ol>
        <p><a href="${safe(options.installationGuideUrl)}">Open the SIM.Africa installation guide</a></p>
      </div>
      <div style="margin-top:20px;"><h2 style="font-size:18px;">Activation</h2><p>${safe(options.activationPolicy ?? "Check the package-specific instructions on the secure order page before installing.")}</p>${options.apn ? `<p><strong>APN:</strong> ${safe(options.apn)}</p>` : ""}</div>
      <p style="margin-top:20px; padding:14px; background:#fff7ed; color:#8c460c; border-radius:12px;"><strong>Important:</strong> Do not delete the eSIM prematurely. Many eSIM profiles cannot be installed again with the same QR code.</p>
      <p style="color: #64748b; font-size: 13px;">Need help? Email <a href="mailto:support@sim.africa">support@sim.africa</a>${options.whatsappUrl ? ` or use <a href="${safe(options.whatsappUrl)}">WhatsApp support</a>` : ""}.</p>
    </div>
  `;

  return {
    subject: `Your SIM.Africa eSIM — ${options.destination ?? options.planName}`,
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
      installation: true,
      profiles: {
        select: { activationCode: true },
        take: 1,
      },
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

  const installationPayload = order.installation?.payload
    ? (() => {
        try {
          const parsed = JSON.parse(order.installation!.payload) as unknown;
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      })()
    : null;
  const delivery = resolveReceiptDeliveryDetails(
    installationPayload,
    order.profiles?.[0]?.activationCode,
  );

  if (!delivery.ready) {
    return { sent: false, skipped: true, reason: "fulfilment_pending" };
  }

  const baseUrl = resolveReceiptBaseUrl({ baseUrl: options.baseUrl });
  if (!baseUrl) {
    return { sent: false, skipped: true, reason: "missing_app_url" };
  }

  const now = new Date();
  const claimed = await db.esimOrder.updateMany({
    where: { id: orderId, receiptSentAt: null },
    data: { receiptSentAt: now, receiptEmail },
  });

  if (claimed.count === 0) {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  const pkg = await findPackageDisplayByIdentifier(db, order.packageId);

  const amountCents = order.totalCents ?? order.payment?.amountCents ?? null;
  const currency = order.currency ?? order.payment?.currency ?? "USD";
  const amountLabel = amountCents === null ? currency : formatCurrency(amountCents, currency);
  const orderReference = order.orderNumber ?? order.requestId ?? order.id;
  const purchasedAt = formatDate(order.createdAt);
  const orderLink = buildOrderLink(order.id, baseUrl);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

  const { subject, text, html } = buildReceiptEmail({
    recipientName: order.user?.name ?? null,
    orderReference,
    planName: pkg?.title ?? "SIM.Africa eSIM plan",
    destination: pkg?.operator?.country?.title ?? null,
    amountLabel,
    status: order.status,
    purchasedAt,
    orderLink,
    installationGuideUrl: `${baseUrl.replace(/\/$/, "")}/help/installation`,
    qrCodeUrl: delivery.qrCodeUrl,
    qrCodeData: delivery.qrCodeData,
    directAppleUrl: delivery.directAppleUrl,
    smdpAddress: delivery.smdpAddress,
    activationCode: delivery.activationCode,
    manualInstallation:
      readPayloadString(installationPayload, "manualInstallation") ??
      pkg?.manualInstallation?.trim() ??
      null,
    activationPolicy: pkg?.operator?.activationPolicy?.trim() || null,
    apn: delivery.apn ?? pkg?.operator?.apnValue?.trim() ?? null,
    whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
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
