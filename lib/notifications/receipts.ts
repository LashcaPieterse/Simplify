import type { PrismaClient } from "@prisma/client";

import { findPackageDisplayByIdentifier } from "@/lib/catalog/package-resolver";
import prismaClient from "@/lib/db/client";
import { formatCurrencyWithCode, formatDate } from "@/lib/format";
import type { SendEmailOptions } from "@/lib/notifications/email";
import { normalizeHttpUrl } from "@/lib/http/safe-url";
import { resolveAiraloApnSettings, type AiraloApnSettings } from "@/lib/airalo/apn";
import {
  formatReceiptActivationPolicy,
  formatReceiptApn,
  formatReceiptInstructions,
} from "./receipt-content";
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

export type SendReceiptOptions = {
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
  apnSettings: AiraloApnSettings | null;
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
    apnSettings: resolveAiraloApnSettings(payload?.apnSettings ?? payload?.apn),
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

function buildOrderLink(orderId: string, baseUrl: string, accessVersion: number): string {
  if (canIssueScopedAccessTokens()) {
    return createOrderAccessLink(orderId, baseUrl, { accessVersion });
  }

  return `${baseUrl}/orders/${orderId}`;
}

export function buildReceiptEmail(options: {
  recipientName: string | null;
  orderReference: string;
  planName: string;
  destination: string | null;
  amountLabel: string;
  displayAmountLabel?: string;
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
  apnSettings?: AiraloApnSettings | null;
  whatsappUrl: string | null;
}) {
  const greeting = options.recipientName ? `Hi ${options.recipientName},` : "Hi there,";
  const destinationLine = options.destination ? `Destination: ${options.destination}` : "";
  const instructions = formatReceiptInstructions(options.manualInstallation);
  const activation = formatReceiptActivationPolicy(options.activationPolicy);
  const apn = formatReceiptApn(options.apn, options.apnSettings);
  const manualValuesReady = Boolean(options.smdpAddress && options.activationCode);
  const iphoneManualStep = "iPhone: Open Settings > Cellular or Mobile Data > Add eSIM > Use QR Code > Enter Details Manually. Enter the SM-DP+ address and activation code in their separate fields.";
  const androidManualStep = "Android: Open Settings and find the option to add an eSIM in SIM manager or Network & internet > SIMs. Choose manual entry if offered. Some phones ask for the full installation code instead of separate fields; menu names vary by device.";
  const topUpNote = "Open your SIM.Africa order to view available top-up options. Availability depends on your eSIM.";

  const textLines = [
    greeting,
    "",
    "Thanks for your SIM.Africa purchase. Your eSIM order details are below:",
    `Order: ${options.orderReference}`,
    `Plan: ${options.planName}`,
    destinationLine,
    `Status: ${options.status}`,
    `Amount: ${options.amountLabel}`,
    options.displayAmountLabel ? `Original displayed estimate: ${options.displayAmountLabel}` : "",
    `Date: ${options.purchasedAt}`,
    "",
    `Manage your order: ${options.orderLink}`,
    "",
    "Before you install",
    "Connect to reliable Wi-Fi and use a compatible, carrier-unlocked phone. Choose one of the available installation methods below.",
    `When your plan starts: ${activation}`,
    "",
    "Install by QR code",
    options.qrCodeUrl ? `QR code: ${options.qrCodeUrl}` : "No QR code URL is currently available. Check the secure order page for the latest fulfilment details.",
    options.qrCodeUrl ? "Open the QR code on a second screen, then scan it from your phone's Add eSIM settings. If you cannot scan it, use an alternative method below." : "",
    options.directAppleUrl ? `Direct iPhone installation: ${options.directAppleUrl}` : "",
    "",
    "Enter details manually",
    manualValuesReady ? iphoneManualStep : "If separate manual values are missing, use the QR code or check the secure order page for installation details.",
    options.qrCodeData || manualValuesReady ? androidManualStep : "",
    options.smdpAddress ? `SM-DP+ address: ${options.smdpAddress}` : "",
    options.activationCode ? `Activation code: ${options.activationCode}` : "",
    options.qrCodeData ? `Full installation code (only if your phone asks for one): ${options.qrCodeData}` : "",
    instructions ? `Plan-specific setup instructions:\n${instructions}` : "Check the secure order page for this plan's connection and roaming instructions.",
    `APN settings: ${apn}`,
    "After installation, select this eSIM for mobile data when you want to use it. Follow the plan-specific roaming instructions above or on your order page.",
    `Detailed installation guide: ${options.installationGuideUrl}`,
    "Important: Do not delete the eSIM prematurely. Many eSIM profiles cannot be installed again with the same QR code.",
    "",
    `Top-ups: ${topUpNote}`,
    `View your order and top-up options: ${options.orderLink}`,
    "Need help? Email support@sim.africa.",
    options.whatsappUrl ? `WhatsApp support: ${options.whatsappUrl}` : "",
  ];

  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  const instructionHtml = instructions?.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n").map((line) => line.trim());
    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return `<ol style="padding-left:20px;line-height:1.6;">${lines.map((line) => `<li>${safe(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }
    if (lines.every((line) => /^[*-]\s+/.test(line))) {
      return `<ul style="padding-left:20px;line-height:1.6;">${lines.map((line) => `<li>${safe(line.replace(/^[*-]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p style="line-height:1.6;">${lines.map(safe).join("<br>")}</p>`;
  }).join("");

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
        ${options.displayAmountLabel ? `<tr><td style="padding:8px 0;color:#64748b;">Original displayed estimate</td><td>${safe(options.displayAmountLabel)}</td></tr>` : ""}
        <tr><td style="padding: 8px 0; color: #64748b;">Date</td><td style="padding: 8px 0; font-weight: 600;">${safe(options.purchasedAt)}</td></tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${safe(options.orderLink)}" style="display:inline-block; background:#1c6b6d; color:#fff; border-radius:999px; padding:12px 20px; font-weight:700; text-decoration:none;">Open secure order &amp; instructions</a>
      </p>
      <div style="margin-top:24px;"><h2 style="font-size:18px;">Before you install</h2><p>Connect to reliable Wi-Fi and use a compatible, carrier-unlocked phone. Choose one of the available installation methods below.</p><p><strong>When your plan starts:</strong> ${safe(activation)}</p></div>
      ${options.qrCodeUrl ? `<div style="margin-top:24px;"><h2 style="font-size:18px;">Install by QR code</h2><p>Open the QR code on a second screen, then scan it from your phone's Add eSIM settings. If you cannot scan it, use an alternative method below.</p><img src="${safe(options.qrCodeUrl)}" alt="QR code for installing the eSIM" width="180" height="180" style="display:block;max-width:180px;height:auto;"></div>` : ""}
      ${options.directAppleUrl ? `<p style="margin-top:16px;"><a href="${safe(options.directAppleUrl)}">Install directly on a supported iPhone</a></p>` : ""}
      <div style="margin-top:20px;">
        <h2 style="font-size:18px;">Enter details manually</h2>
        <p>${safe(manualValuesReady ? iphoneManualStep : "If separate manual values are missing, use the QR code or check the secure order page for installation details.")}</p>
        ${options.qrCodeData || manualValuesReady ? `<p>${safe(androidManualStep)}</p>` : ""}
        ${options.smdpAddress ? `<p><strong>SM-DP+ address:</strong> <span style="font-family:monospace;overflow-wrap:anywhere;">${safe(options.smdpAddress)}</span></p>` : ""}
        ${options.activationCode ? `<p><strong>Activation code:</strong> <span style="font-family:monospace;overflow-wrap:anywhere;">${safe(options.activationCode)}</span></p>` : ""}
        ${options.qrCodeData ? `<p><strong>Full installation code (only if your phone asks for one):</strong><br><span style="font-family:monospace;white-space:pre-wrap;overflow-wrap:anywhere;">${safe(options.qrCodeData)}</span></p>` : ""}
      </div>
      ${instructionHtml ? `<div style="margin-top:20px;overflow-wrap:anywhere;"><h2 style="font-size:18px;">Plan-specific setup instructions</h2>${instructionHtml}</div>` : ""}
      <div style="margin-top:20px;">
        <h2 style="font-size:18px;">Connect after installation</h2>
        <p>Select this eSIM for mobile data when you want to use it. Follow the plan-specific connection and roaming instructions above or on your secure order page.</p>
        <p><strong>APN settings:</strong> ${safe(apn)}</p>
        <p><a href="${safe(options.installationGuideUrl)}">Open the SIM.Africa installation guide</a></p>
      </div>
      <p style="margin-top:20px; padding:14px; background:#fff7ed; color:#8c460c; border-radius:12px;"><strong>Important:</strong> Do not delete the eSIM prematurely. Many eSIM profiles cannot be installed again with the same QR code.</p>
      <div style="margin-top:20px;"><h2 style="font-size:18px;">Top-ups</h2><p>${safe(topUpNote)} <a href="${safe(options.orderLink)}">View your order and top-up options</a>.</p></div>
      <p style="color: #64748b; font-size: 13px;">Need help? Email <a href="mailto:support@sim.africa">support@sim.africa</a>${options.whatsappUrl ? ` or use <a href="${safe(options.whatsappUrl)}">WhatsApp support</a>` : ""}.</p>
    </div>
  `;

  return {
    subject: `Your SIM.Africa eSIM — ${options.destination ?? options.planName}`,
    text: textLines.join("\n").replace(/\n{3,}/g, "\n\n"),
    html,
  };
}

export async function prepareOrderReceipt(
  orderId: string,
  options: SendReceiptOptions = {},
): Promise<ReceiptSendResult | { payload: SendEmailOptions }> {
  const db = options.prisma ?? prismaClient;

  const order = await db.esimOrder.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true } },
      payment: true,
      checkout: { include: { quote: true } },
      saleCheckout: true,
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

  if (order.ownershipReviewRequired) return { sent: false, skipped: true, reason: "ownership_review" };
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

  const pkg = await findPackageDisplayByIdentifier(db, order.packageId);

  const amountCents = order.totalCents ?? order.payment?.amountCents ?? null;
  const currency = order.currency ?? order.payment?.currency ?? "USD";
  const amountLabel = amountCents === null ? currency : formatCurrencyWithCode(amountCents, currency);
  const orderReference = order.orderNumber ?? order.requestId ?? order.id;
  const purchasedAt = formatDate(order.createdAt);
  const orderLink = buildOrderLink(order.id, baseUrl, order.accessVersion);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

  const { subject, text, html } = buildReceiptEmail({
    recipientName: order.user?.name ?? null,
    orderReference,
    planName: pkg?.title ?? "SIM.Africa eSIM plan",
    destination: pkg?.operator?.country?.title ?? null,
    amountLabel: order.replacementForId ? `${amountLabel} — replacement, no additional customer charge` : amountLabel,
    displayAmountLabel: order.checkout?.quote ? formatCurrencyWithCode(order.checkout.quote.displayCents, order.checkout.quote.displayCurrency) : undefined,
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
    apnSettings: delivery.apnSettings,
    whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
  });

  return { payload: { to: receiptEmail, subject, text, html, from: process.env.RECEIPT_EMAIL_FROM ?? DEFAULT_FROM } };
}

/** Compatibility entrypoint: callers enqueue durable work; only the worker sends. */
export async function sendOrderReceipt(orderId: string, options: SendReceiptOptions = {}): Promise<ReceiptSendResult> {
  const { queueOrderReceipt } = await import("./receipt-outbox");
  const queued = await queueOrderReceipt(options.prisma ?? prismaClient, orderId);
  return { sent: false, skipped: !queued, reason: queued ? "queued" : "already_sent" };
}
