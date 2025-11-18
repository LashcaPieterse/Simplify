import { AiraloClient, AiraloError } from "./client";
import type {
  InstallationInstructions as RawInstallationInstructions,
  InstallationStepDictionary,
  PlatformInstallationInstructions,
} from "./schemas";
import { resolveSharedTokenCache } from "./token-cache";

const FAQ_URL =
  "https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ";

export type InstallationPlatformName = "ios" | "android";

export interface InstallationInstructionStep {
  order: number;
  text: string;
}

export interface InstallationQrInstructions {
  steps: InstallationInstructionStep[];
  qrCodeData: string | null;
  qrCodeUrl: string | null;
  directAppleInstallationUrl: string | null;
}

export interface InstallationManualInstructions {
  steps: InstallationInstructionStep[];
  smdpAddressAndActivationCode: string | null;
}

export interface InstallationNetworkSetup {
  steps: InstallationInstructionStep[];
  apnType: string | null;
  apnValue: string | null;
  isRoaming: boolean | null;
}

export interface InstallationPlatformInstructions {
  id: string;
  platform: InstallationPlatformName;
  model: string | null;
  version: string | null;
  qr: InstallationQrInstructions | null;
  manual: InstallationManualInstructions | null;
  network: InstallationNetworkSetup | null;
}

export interface InstallationInstructionsResult {
  language: string;
  requestedLanguage: string | null;
  isRequestedLanguageAvailable: boolean;
  faqUrl: string;
  platforms: InstallationPlatformInstructions[];
}

export interface InstallationInstructionsOptions {
  acceptLanguage?: string | null;
  airaloClient?: AiraloClient;
}

export class InstallationInstructionsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InstallationInstructionsError";
    this.status = status;
  }
}

let cachedClient: AiraloClient | null = null;

function resolveAiraloClient(): AiraloClient {
  if (cachedClient) {
    return cachedClient;
  }

  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new InstallationInstructionsError(
      "AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be configured to load installation instructions.",
      500,
    );
  }

  cachedClient = new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });

  return cachedClient;
}

function normalizeSteps(
  steps: InstallationStepDictionary | undefined | null,
): InstallationInstructionStep[] {
  if (!steps) {
    return [];
  }

  return Object.entries(steps)
    .map(([order, text]) => ({
      order: Number(order),
      text: (text ?? "").trim(),
    }))
    .filter((entry) => entry.text.length > 0 && Number.isFinite(entry.order))
    .sort((a, b) => a.order - b.order);
}

function normalizePlatform(
  platform: PlatformInstallationInstructions,
  platformName: InstallationPlatformName,
  index: number,
): InstallationPlatformInstructions {
  const qrSection = platform.installation_via_qr_code;
  const manualSection = platform.installation_manual;
  const networkSection = platform.network_setup;

  return {
    id: `${platformName}-${index}`,
    platform: platformName,
    model: platform.model ?? null,
    version: platform.version ?? null,
    qr: qrSection
      ? {
          steps: normalizeSteps(qrSection.steps),
          qrCodeData: qrSection.qr_code_data ?? null,
          qrCodeUrl: qrSection.qr_code_url ?? null,
          directAppleInstallationUrl:
            qrSection.direct_apple_installation_url ?? null,
        }
      : null,
    manual: manualSection
      ? {
          steps: normalizeSteps(manualSection.steps),
          smdpAddressAndActivationCode:
            manualSection.smdp_address_and_activation_code ?? null,
        }
      : null,
    network: networkSection
      ? {
          steps: normalizeSteps(networkSection.steps),
          apnType: networkSection.apn_type ?? null,
          apnValue: networkSection.apn_value ?? null,
          isRoaming:
            typeof networkSection.is_roaming === "boolean"
              ? networkSection.is_roaming
              : null,
        }
      : null,
  };
}

function normalizeLanguageTag(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const firstSegment = value.split(",")[0]?.trim();
  if (!firstSegment) {
    return null;
  }

  const [languagePart] = firstSegment.split(/[-_]/);
  if (!languagePart) {
    return null;
  }

  return languagePart.toLowerCase();
}

function instructionsMatchRequestedLanguage(
  instructionsLanguage: string,
  requestedLanguage: string | null,
): boolean {
  if (!requestedLanguage) {
    return true;
  }

  const normalizedInstructions = normalizeLanguageTag(instructionsLanguage);
  const normalizedRequested = normalizeLanguageTag(requestedLanguage);

  if (!normalizedInstructions || !normalizedRequested) {
    return true;
  }

  return normalizedInstructions.startsWith(normalizedRequested);
}

function normalizeInstructions(
  instructions: RawInstallationInstructions,
  requestedLanguage: string | null,
): InstallationInstructionsResult {
  const iosPlatforms = instructions.ios.map((platform, index) =>
    normalizePlatform(platform, "ios", index),
  );
  const androidPlatforms = instructions.android.map((platform, index) =>
    normalizePlatform(platform, "android", index),
  );

  return {
    language: instructions.language,
    requestedLanguage,
    isRequestedLanguageAvailable: instructionsMatchRequestedLanguage(
      instructions.language,
      requestedLanguage,
    ),
    faqUrl: FAQ_URL,
    platforms: [...iosPlatforms, ...androidPlatforms],
  };
}

export async function getInstallationInstructions(
  simIccid: string,
  options: InstallationInstructionsOptions = {},
): Promise<InstallationInstructionsResult> {
  const iccid = simIccid?.trim();

  if (!iccid) {
    throw new InstallationInstructionsError(
      "A SIM ICCID is required to request installation instructions.",
      422,
    );
  }

  const client = options.airaloClient ?? resolveAiraloClient();
  const languageHint = options.acceptLanguage?.trim() ?? null;

  try {
    const instructions = await client.getSimInstallationInstructions(iccid, {
      acceptLanguage: languageHint ?? undefined,
    });

    return normalizeInstructions(instructions, languageHint);
  } catch (error) {
    if (error instanceof InstallationInstructionsError) {
      throw error;
    }

    if (error instanceof AiraloError) {
      const status = error.details.status ?? 502;
      const message =
        status === 404
          ? "We couldn't find instructions for that ICCID. Double-check the number and try again."
          : status === 401 || status === 403
            ? "We couldn't authenticate with Airalo. Verify your API credentials."
            : "Airalo returned an unexpected response while loading the instructions.";

      throw new InstallationInstructionsError(message, status);
    }

    throw new InstallationInstructionsError(
      "Unexpected error while loading installation instructions.",
      500,
    );
  }
}
