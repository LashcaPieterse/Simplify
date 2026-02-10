import { AiraloClient } from "./airalo/client";
import type { Sim, Simable } from "./airalo/schemas";
import { resolveSharedTokenCache } from "./airalo/token-cache";

export interface InstallationGuide {
  language: string;
  url: string;
}

export interface InstallationInstructions {
  manualHtml: string | null;
  qrCodeHtml: string | null;
  guides: InstallationGuide[];
}

export interface SimStatusInfo {
  name: string | null;
  slug: string | null;
}

export interface SimUserInfo {
  id: number | null;
  name: string | null;
  email: string | null;
  company: string | null;
}

export interface SimShareInfo {
  link: string | null;
  accessCode: string | null;
}

export interface SimableDetails {
  id: number;
  code: string | null;
  description: string | null;
  type: string | null;
  packageId: string | null;
  packageName: string | null;
  esimType: string | null;
  validity: string | null;
  price: string | null;
  dataAmount: string | null;
  currency: string | null;
  quantity: number | null;
  status: SimStatusInfo | null;
  user: SimUserInfo | null;
  sharing: SimShareInfo | null;
  installationInstructions: InstallationInstructions | null;
}

export interface AiraloSimDetails {
  id: number;
  createdAt: string;
  iccid: string;
  lpa: string | null;
  matchingId: string | null;
  qrcode: string | null;
  qrcodeUrl: string | null;
  directAppleInstallationUrl: string | null;
  voucherCode: string | null;
  airaloCode: string | null;
  apnType: string | null;
  apnValue: string | null;
  isRoaming: boolean | null;
  confirmationCode: string | null;
  brandSettingsName: string | null;
  recycled: boolean;
  recycledAt: string | null;
  simable: SimableDetails | null;
}

export interface GetSimDetailsOptions {
  include?: string | string[];
  airaloClient?: AiraloClient;
}

export class AiraloConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiraloConfigurationError";
  }
}

let cachedClient: AiraloClient | null = null;


function requiredEnv(name: "AIRALO_CLIENT_ID" | "AIRALO_CLIENT_SECRET"): string {
  const raw = process.env[name];
  const value = raw?.trim();

  if (!value) {
    throw new AiraloConfigurationError(`${name} must be configured to fetch SIM details.`);
  }

  return value;
}

function resolveClient(): AiraloClient {
  if (cachedClient) {
    return cachedClient;
  }

  const clientId = requiredEnv("AIRALO_CLIENT_ID");
  const clientSecret = requiredEnv("AIRALO_CLIENT_SECRET");

  cachedClient = new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });

  return cachedClient;
}

function normalizeHtml(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGuides(guides: Record<string, string> | null | undefined): InstallationGuide[] {
  if (!guides) {
    return [];
  }

  return Object.entries(guides)
    .map(([language, url]) => {
      const normalizedLanguage = language.trim();
      const normalizedUrl = typeof url === "string" ? url.trim() : "";

      if (!normalizedLanguage || !normalizedUrl) {
        return null;
      }

      return { language: normalizedLanguage, url: normalizedUrl };
    })
    .filter((guide): guide is InstallationGuide => Boolean(guide));
}

function normalizeInstallationInstructions(simable: Simable | null | undefined): InstallationInstructions | null {
  if (!simable) {
    return null;
  }

  const manualHtml = normalizeHtml(simable.manual_installation);
  const qrCodeHtml = normalizeHtml(simable.qrcode_installation);
  const guides = normalizeGuides(simable.installation_guides ?? undefined);

  if (!manualHtml && !qrCodeHtml && guides.length === 0) {
    return null;
  }

  return {
    manualHtml,
    qrCodeHtml,
    guides,
  };
}

function normalizeSimable(simable: Simable | null | undefined): SimableDetails | null {
  if (!simable) {
    return null;
  }

  return {
    id: simable.id,
    code: simable.code ?? null,
    description: simable.description ?? null,
    type: simable.type ?? null,
    packageId: simable.package_id ?? null,
    packageName: simable.package ?? null,
    esimType: simable.esim_type ?? null,
    validity: simable.validity ?? null,
    price: simable.price ?? null,
    dataAmount: simable.data ?? null,
    currency: simable.currency ?? null,
    quantity: typeof simable.quantity === "number" ? simable.quantity : null,
    status: simable.status
      ? {
          name: simable.status.name ?? null,
          slug: simable.status.slug ?? null,
        }
      : null,
    user: simable.user
      ? {
          id: typeof simable.user.id === "number" ? simable.user.id : null,
          name: simable.user.name ?? null,
          email: simable.user.email ?? null,
          company: simable.user.company ?? null,
        }
      : null,
    sharing: simable.sharing
      ? {
          link: simable.sharing.link ?? null,
          accessCode: simable.sharing.access_code ?? null,
        }
      : null,
    installationInstructions: normalizeInstallationInstructions(simable),
  };
}

function normalizeSim(sim: Sim): AiraloSimDetails {
  return {
    id: sim.id,
    createdAt: sim.created_at,
    iccid: sim.iccid,
    lpa: sim.lpa ?? null,
    matchingId: sim.matching_id ?? null,
    qrcode: sim.qrcode ?? null,
    qrcodeUrl: sim.qrcode_url ?? null,
    directAppleInstallationUrl: sim.direct_apple_installation_url ?? null,
    voucherCode: sim.voucher_code ?? null,
    airaloCode: sim.airalo_code ?? null,
    apnType: sim.apn_type ?? null,
    apnValue: sim.apn_value ?? null,
    isRoaming: typeof sim.is_roaming === "boolean" ? sim.is_roaming : null,
    confirmationCode: sim.confirmation_code ?? null,
    brandSettingsName: sim.brand_settings_name ?? null,
    recycled: Boolean(sim.recycled),
    recycledAt: sim.recycled_at ?? null,
    simable: normalizeSimable(sim.simable ?? null),
  };
}

export async function getSimDetails(
  iccid: string,
  options: GetSimDetailsOptions = {},
): Promise<AiraloSimDetails> {
  const normalizedIccid = iccid?.trim();
  if (!normalizedIccid) {
    throw new Error("A SIM ICCID is required to request SIM details.");
  }

  const client = options.airaloClient ?? resolveClient();
  const sim = await client.getSim(normalizedIccid, { include: options.include });
  return normalizeSim(sim);
}

export function getAiraloClient(): AiraloClient {
  return resolveClient();
}
