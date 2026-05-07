import { AiraloClient } from "../lib/airalo/client";

type EndpointKey = "token" | "packages" | "sim_usage" | "sim_packages" | "other";

interface EndpointStats {
  calls: number;
  statuses: number[];
}

interface SmokeSummary {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  checks: Record<string, { ok: boolean; message: string }>;
  endpoints: Record<EndpointKey, EndpointStats>;
}

const stats: Record<EndpointKey, EndpointStats> = {
  token: { calls: 0, statuses: [] },
  packages: { calls: 0, statuses: [] },
  sim_usage: { calls: 0, statuses: [] },
  sim_packages: { calls: 0, statuses: [] },
  other: { calls: 0, statuses: [] },
};

function classifyEndpoint(url: string): EndpointKey {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (path.endsWith("/token")) {
      return "token";
    }
    if (path.endsWith("/packages") && path.includes("/sims/")) {
      return "sim_packages";
    }
    if (path.endsWith("/usage") && path.includes("/sims/")) {
      return "sim_usage";
    }
    if (path.endsWith("/packages")) {
      return "packages";
    }
  } catch {
    // ignore parse issues and classify as other
  }

  return "other";
}

const instrumentedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  const endpoint = classifyEndpoint(url);
  stats[endpoint].calls += 1;

  const response = await fetch(input, init);
  stats[endpoint].statuses.push(response.status);
  return response;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set.`);
  }
  return value;
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const checks: SmokeSummary["checks"] = {};

  const client = new AiraloClient({
    clientId: required("AIRALO_CLIENT_ID"),
    clientSecret: required("AIRALO_CLIENT_SECRET"),
    baseUrl: process.env.AIRALO_BASE_URL,
    fetchImplementation: instrumentedFetch,
  });

  const packagesFirst = await client.getPackages({ limit: 1, page: 1 });
  checks.packages_first_call = {
    ok: packagesFirst.length > 0,
    message:
      packagesFirst.length > 0
        ? `Fetched ${packagesFirst.length} package(s).`
        : "No packages returned from first call.",
  };

  const packagesSecond = await client.getPackages({ limit: 1, page: 1 });
  checks.packages_second_call = {
    ok: packagesSecond.length > 0,
    message:
      packagesSecond.length > 0
        ? `Fetched ${packagesSecond.length} package(s).`
        : "No packages returned from second call.",
  };

  checks.token_reuse = {
    ok: stats.token.calls <= 1,
    message:
      stats.token.calls <= 1
        ? `Token endpoint called ${stats.token.calls} time(s) across two /packages calls.`
        : `Token endpoint called ${stats.token.calls} time(s); expected <= 1 for cache reuse.`,
  };

  const iccid = process.env.AIRALO_SMOKE_ICCID?.trim();
  if (iccid) {
    try {
      await client.getSimUsage(iccid);
      checks.sim_usage = {
        ok: true,
        message: "SIM usage endpoint succeeded.",
      };
    } catch (error) {
      checks.sim_usage = {
        ok: false,
        message: `SIM usage endpoint failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    try {
      const topups = await client.getSimPackages(iccid);
      checks.sim_packages = {
        ok: true,
        message: `SIM packages endpoint succeeded with ${topups.length} package(s).`,
      };
    } catch (error) {
      checks.sim_packages = {
        ok: false,
        message: `SIM packages endpoint failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } else {
    checks.sim_usage = {
      ok: true,
      message: "Skipped (set AIRALO_SMOKE_ICCID to enable).",
    };
    checks.sim_packages = {
      ok: true,
      message: "Skipped (set AIRALO_SMOKE_ICCID to enable).",
    };
  }

  const summary: SmokeSummary = {
    ok: Object.values(checks).every((check) => check.ok),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    checks,
    endpoints: stats,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Airalo live smoke test failed", error);
  process.exitCode = 1;
});

