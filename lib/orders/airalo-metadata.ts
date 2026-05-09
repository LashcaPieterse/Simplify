import type { Order as AiraloOrder, Sim as AiraloSim } from "../airalo/schemas";

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
  const source =
    typeof maybeContainer === "object" && maybeContainer !== null
      ? maybeContainer
      : metadata;

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

function resolveStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function resolveBooleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function resolvePrimaryOrderSim(order: AiraloOrder | null | undefined) {
  if (Array.isArray(order?.sims) && order.sims.length > 0) {
    return order.sims[0];
  }

  return null;
}

function parseLpaCode(value: unknown): {
  smdpAddress: string | null;
  activationCode: string | null;
} {
  const text = resolveStringValue(value);
  if (!text) {
    return { smdpAddress: null, activationCode: null };
  }

  const match = text.match(/^LPA:\d+\$([^$]+)\$(.+)$/i);
  if (!match) {
    return { smdpAddress: null, activationCode: null };
  }

  return {
    smdpAddress: resolveStringValue(match[1]),
    activationCode: resolveStringValue(match[2]),
  };
}

function normalizeShareInfo(sim: AiraloSim | null | undefined) {
  const sharing = sim?.simable?.sharing;
  if (!sharing) {
    return null;
  }

  const link = resolveStringValue(sharing.link);
  const accessCode = resolveStringValue(sharing.access_code);

  if (!link && !accessCode) {
    return null;
  }

  return {
    link,
    accessCode,
  };
}

export function resolveAiraloSimActivationCode(
  sim: AiraloSim | null | undefined,
): string | null {
  if (!sim) {
    return null;
  }

  const parsedQr = parseLpaCode(sim.qrcode);

  return (
    resolveStringValue(sim.matching_id) ??
    parsedQr.activationCode ??
    null
  );
}

export function resolveAiraloOrderActivationCode(
  order: AiraloOrder | null | undefined,
  sim?: AiraloSim | null,
): string | null {
  if (!order && !sim) {
    return null;
  }

  const firstSim = resolvePrimaryOrderSim(order);
  const firstSimRecord =
    firstSim && typeof firstSim === "object"
      ? (firstSim as Record<string, unknown>)
      : null;
  const orderActivationCode = resolveStringValue(order?.activation_code);
  const parsedOrderActivationCode = parseLpaCode(orderActivationCode);
  const firstSimActivationCode = resolveStringValue(
    firstSimRecord?.activation_code,
  );
  const parsedFirstSimActivationCode = parseLpaCode(firstSimActivationCode);
  const parsedFirstSimQr = parseLpaCode(firstSimRecord?.qrcode);

  return (
    parsedOrderActivationCode.activationCode ??
    orderActivationCode ??
    parsedFirstSimActivationCode.activationCode ??
    firstSimActivationCode ??
    resolveAiraloSimActivationCode(sim) ??
    resolveStringValue(firstSimRecord?.matching_id) ??
    parsedFirstSimQr.activationCode
  );
}

export function resolveAiraloSimStatus(
  sim: AiraloSim | null | undefined,
): string | null {
  const status = sim?.simable?.status;
  return (
    resolveStringValue(status?.slug) ??
    resolveStringValue(status?.name)?.toLowerCase() ??
    null
  );
}

export function resolveAiraloOrderApn(
  order: AiraloOrder | null | undefined,
  sim?: AiraloSim | null,
): string | null {
  const firstSim = resolvePrimaryOrderSim(order);
  const orderRecord = order as Record<string, unknown>;
  const firstSimRecord =
    firstSim && typeof firstSim === "object"
      ? (firstSim as Record<string, unknown>)
      : null;
  const simRecord =
    sim && typeof sim === "object" ? (sim as Record<string, unknown>) : null;

  return (
    resolveStringValue(orderRecord?.apn) ??
    resolveStringValue(orderRecord?.apn_value) ??
    resolveStringValue(firstSimRecord?.apn) ??
    resolveStringValue(firstSimRecord?.apn_value) ??
    resolveStringValue(simRecord?.apn) ??
    resolveStringValue(simRecord?.apn_value)
  );
}

export function createInstallationPayload(
  order: AiraloOrder | null | undefined,
  sim?: AiraloSim | null,
): string {
  const firstSim = resolvePrimaryOrderSim(order);
  const orderRecord =
    order && typeof order === "object" ? (order as Record<string, unknown>) : {};
  const firstSimRecord =
    firstSim && typeof firstSim === "object"
      ? (firstSim as Record<string, unknown>)
      : null;
  const simRecord =
    sim && typeof sim === "object" ? (sim as Record<string, unknown>) : null;
  const resolvedOrderId = order?.order_id ?? order?.id ?? order?.code ?? null;
  const qrCodeData =
    resolveStringValue(simRecord?.qrcode) ??
    resolveStringValue(firstSimRecord?.qrcode) ??
    resolveStringValue(orderRecord.qr_code) ??
    resolveStringValue(orderRecord.qr_code_data) ??
    resolveStringValue(orderRecord.esim);
  const parsedQr = parseLpaCode(qrCodeData);
  const lpa =
    resolveStringValue(simRecord?.lpa) ??
    resolveStringValue(firstSimRecord?.lpa) ??
    parsedQr.smdpAddress;
  const matchingId =
    resolveStringValue(simRecord?.matching_id) ??
    resolveStringValue(firstSimRecord?.matching_id) ??
    parsedQr.activationCode;
  const activationCode =
    resolveAiraloOrderActivationCode(order, sim) ?? matchingId;
  const qrCodeUrl =
    resolveStringValue(simRecord?.qrcode_url) ??
    resolveStringValue(firstSimRecord?.qrcode_url) ??
    resolveStringValue(orderRecord.qr_code_url);
  const directAppleUrl =
    resolveStringValue(simRecord?.direct_apple_installation_url) ??
    resolveStringValue(firstSimRecord?.direct_apple_installation_url) ??
    resolveStringValue(orderRecord.direct_apple_installation_url);
  const simStatus = sim?.simable?.status
    ? {
        name: resolveStringValue(sim.simable.status.name),
        slug: resolveStringValue(sim.simable.status.slug),
      }
    : null;

  const payload = {
    source: sim ? "sim" : "order",
    orderId: resolvedOrderId,
    orderReference: order?.order_reference ?? null,
    simId: sim?.id ?? null,
    iccid:
      resolveStringValue(simRecord?.iccid) ??
      resolveStringValue(orderRecord.iccid) ??
      resolveStringValue(firstSimRecord?.iccid),
    lpa,
    matchingId,
    activationCode,
    qrCodeData,
    qrCodeUrl,
    // Legacy alias retained for existing payload readers. Prefer qrCodeUrl/qrCodeData.
    qrCode: qrCodeUrl ?? qrCodeData,
    esim: resolveStringValue(orderRecord.esim) ?? lpa,
    directAppleUrl,
    apn: resolveAiraloOrderApn(order, sim),
    apnType:
      resolveStringValue(simRecord?.apn_type) ??
      resolveStringValue(firstSimRecord?.apn_type) ??
      resolveStringValue(orderRecord.apn_type),
    isRoaming:
      resolveBooleanValue(simRecord?.is_roaming) ??
      resolveBooleanValue(firstSimRecord?.is_roaming) ??
      resolveBooleanValue(orderRecord.is_roaming),
    confirmationCode: resolveStringValue(simRecord?.confirmation_code),
    voucherCode: resolveStringValue(simRecord?.voucher_code),
    airaloCode: resolveStringValue(simRecord?.airalo_code),
    brandSettingsName: resolveStringValue(simRecord?.brand_settings_name),
    recycled: resolveBooleanValue(simRecord?.recycled),
    recycledAt: resolveStringValue(simRecord?.recycled_at),
    simStatus,
    share: normalizeShareInfo(sim),
    packageId:
      resolveStringValue(sim?.simable?.package_id) ??
      resolveStringValue(orderRecord.package_id),
    packageName: resolveStringValue(sim?.simable?.package),
    dataAmount: resolveStringValue(sim?.simable?.data),
    validity: resolveStringValue(sim?.simable?.validity),
    manualInstallation: resolveStringValue(sim?.simable?.manual_installation),
    qrCodeInstallation: resolveStringValue(sim?.simable?.qrcode_installation),
    installationGuides: sim?.simable?.installation_guides ?? null,
  };

  return JSON.stringify(payload);
}
