import type { Order as AiraloOrder } from "../airalo/schemas";

export interface UsageMetadata {
  usedMb?: number;
  remainingMb?: number;
}

export function extractActivationCode(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const value =
    (metadata as { activation_code?: unknown }).activation_code ??
    (metadata as { activationCode?: unknown }).activationCode;

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function readNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export function extractUsage(metadata: unknown): UsageMetadata | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const maybeContainer = (metadata as { usage?: unknown }).usage;
  const source = typeof maybeContainer === "object" && maybeContainer !== null ? maybeContainer : metadata;

  const usedMb =
    readNumber((source as { used_mb?: unknown }).used_mb) ??
    readNumber((source as { usedMb?: unknown }).usedMb) ??
    readNumber((source as { used?: unknown }).used);
  const remainingMb =
    readNumber((source as { remaining_mb?: unknown }).remaining_mb) ??
    readNumber((source as { remainingMb?: unknown }).remainingMb) ??
    readNumber((source as { remaining?: unknown }).remaining);

  if (usedMb === null && remainingMb === null) {
    return null;
  }

  const usage: UsageMetadata = {};
  if (usedMb !== null) {
    usage.usedMb = usedMb;
  }

  if (remainingMb !== null) {
    usage.remainingMb = remainingMb;
  }

  return usage;
}

export function createInstallationPayload(order: AiraloOrder): string {
  const payload = {
    orderId: order.order_id,
    orderReference: order.order_reference ?? null,
    iccid: order.iccid ?? null,
    activationCode: order.activation_code ?? null,
    qrCode: order.qr_code ?? null,
    esim: order.esim ?? null,
  };

  return JSON.stringify(payload);
}
