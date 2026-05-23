import assert from "node:assert/strict";
import test from "node:test";

import { AiraloClient } from "./client";
import { getInstallationInstructions } from "./installInstructions";
import type { TokenCache, TokenCacheRecord } from "./token-cache";

class MockTokenCache implements TokenCache {
  constructor(private record: TokenCacheRecord | null = null) {}

  async get(): Promise<TokenCacheRecord | null> {
    return this.record;
  }

  async set(record: TokenCacheRecord): Promise<void> {
    this.record = record;
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

test("getInstallationInstructions normalizes the documented Airalo instructions payload", async () => {
  const tokenCache = new MockTokenCache({
    token: "cached-token",
    expiresAt: Date.now() + 60_000,
    tokenType: "Bearer",
  });

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.endsWith("/sims/8944465400000267221/instructions")) {
      return new Response(
        JSON.stringify({
          data: {
            instructions: {
              language: "EN",
              ios: [
                {
                  model: null,
                  version: "14,15,13",
                  installation_via_qr_code: {
                    steps: {
                      "2": "Scan the QR Code.",
                      "1": "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
                    },
                    qr_code_data: "LPA:1$lpa.airalo.com$TEST",
                    qr_code_url: "https://sandbox.airalo.com/qr?id=115516",
                    direct_apple_installation_url:
                      "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$lpa.airalo.com$TEST",
                  },
                  installation_manual: {
                    steps: {
                      "2": "Tap on 'Enter Details Manually'.",
                      "1": "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
                    },
                    smdp_address_and_activation_code: "lpa.airalo.com",
                  },
                  network_setup: {
                    steps: {
                      "2": "Ensure that 'Turn On This Line' is toggled on.",
                      "1": "Select your eSIM under 'Cellular Plans'.",
                    },
                    apn_type: "manual",
                    apn_value: "singleall",
                    is_roaming: true,
                  },
                },
              ],
              android: [
                {
                  model: null,
                  version: null,
                  installation_via_qr_code: {
                    steps: {
                      "1": "Go to Settings > Connections > SIM Card Manager.",
                    },
                    qr_code_data: "LPA:1$lpa.airalo.com$TEST",
                    qr_code_url: "https://sandbox.airalo.com/qr?id=115516",
                  },
                  installation_manual: {
                    steps: {
                      "1": "Go to Settings > Connections > SIM Card Manager.",
                    },
                    smdp_address_and_activation_code: "lpa.airalo.com",
                  },
                  network_setup: {
                    steps: {
                      "1": "Enable the Mobile Data.",
                    },
                    apn_type: "manual",
                    apn_value: "singleall",
                    is_roaming: true,
                  },
                },
              ],
            },
          },
          meta: { message: "success" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = new AiraloClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const result = await getInstallationInstructions("8944465400000267221", {
    acceptLanguage: "en-US,en;q=0.9",
    airaloClient: client,
  });

  assert.equal(result.language, "EN");
  assert.equal(result.requestedLanguage, "en-US,en;q=0.9");
  assert.equal(result.isRequestedLanguageAvailable, true);
  assert.equal(result.platforms.length, 2);

  const ios = result.platforms.find((platform) => platform.platform === "ios");
  assert(ios, "expected iOS instructions");
  assert.equal(ios.version, "14,15,13");
  assert.deepEqual(
    ios.qr?.steps.map((step) => step.text),
    [
      "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
      "Scan the QR Code.",
    ],
  );
  assert.equal(ios.qr?.qrCodeData, "LPA:1$lpa.airalo.com$TEST");
  assert.equal(ios.qr?.qrCodeUrl, "https://sandbox.airalo.com/qr?id=115516");
  assert.equal(
    ios.qr?.directAppleInstallationUrl,
    "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$lpa.airalo.com$TEST",
  );
  assert.deepEqual(
    ios.manual?.steps.map((step) => step.text),
    [
      "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
      "Tap on 'Enter Details Manually'.",
    ],
  );
  assert.equal(ios.manual?.smdpAddressAndActivationCode, "lpa.airalo.com");
  assert.deepEqual(
    ios.network?.steps.map((step) => step.text),
    [
      "Select your eSIM under 'Cellular Plans'.",
      "Ensure that 'Turn On This Line' is toggled on.",
    ],
  );
  assert.equal(ios.network?.apnType, "manual");
  assert.equal(ios.network?.apnValue, "singleall");
  assert.equal(ios.network?.isRoaming, true);

  const android = result.platforms.find(
    (platform) => platform.platform === "android",
  );
  assert(android, "expected Android instructions");
  assert.equal(android.qr?.qrCodeData, "LPA:1$lpa.airalo.com$TEST");
  assert.equal(android.manual?.smdpAddressAndActivationCode, "lpa.airalo.com");
  assert.equal(android.network?.apnType, "manual");
  assert.equal(android.network?.apnValue, "singleall");
  assert.equal(android.network?.isRoaming, true);
});
