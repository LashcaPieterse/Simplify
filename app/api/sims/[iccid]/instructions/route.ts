import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { jsonApiError, jsonBadRequest, jsonServerError } from "@/lib/api/errors";
import {
  getInstallationInstructions,
  InstallationInstructionsError,
} from "@/lib/airalo/installInstructions";
import { getSimDetails } from "@/lib/airalo";
import { isValidIccid, normalizeIccid } from "@/lib/esim/iccid";
import type { InstallationInstructionsPayload } from "@/lib/esim/instructionsPayload";

const CACHE_TAG: string[] = ["airalo", "sims", "instructions"];
const CACHE_REVALIDATE_SECONDS = 60 * 30;

function getCachedInstructions(iccid: string, language: string) {
  const cacheKey = [...CACHE_TAG, iccid, language];

  const loadInstructions = unstable_cache(
    async () => getInstallationInstructions(iccid, { acceptLanguage: language }),
    cacheKey,
    { revalidate: CACHE_REVALIDATE_SECONDS },
  );

  return loadInstructions();
}

function extractPreferredLanguage(headerValue: string | null): string {
  if (!headerValue) {
    return "en";
  }

  const [first] = headerValue.split(",");
  return first?.trim() || "en";
}

export async function GET(
  request: Request,
  { params }: { params: { iccid: string } },
) {
  const iccid = normalizeIccid(decodeURIComponent(params.iccid ?? ""));

  if (!iccid) {
    return jsonBadRequest(
      "iccid_required",
      "An ICCID is required to look up installation instructions.",
    );
  }

  if (!isValidIccid(iccid)) {
    return jsonApiError(
      422,
      "invalid_iccid",
      "Enter a valid ICCID before requesting installation instructions.",
    );
  }

  const preferredLanguage = extractPreferredLanguage(
    request.headers.get("accept-language"),
  );

  const simDetailsPromise = getSimDetails(iccid, { include: ["share"] }).catch(
    (error) => {
      console.error("Failed to load SIM status while fetching instructions", error);
      return null;
    },
  );

  try {
    const instructions = await getCachedInstructions(iccid, preferredLanguage);
    const simDetails = await simDetailsPromise;

    const payload: InstallationInstructionsPayload = {
      instructions,
      simStatus: simDetails?.simable?.status ?? null,
      recycled: Boolean(simDetails?.recycled),
      recycledAt: simDetails?.recycledAt ?? null,
      share: (instructions.share ?? simDetails?.simable?.sharing) ?? null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof InstallationInstructionsError) {
      return jsonApiError(
        error.status,
        "installation_instructions_error",
        error.message,
      );
    }

    console.error("Failed to load installation instructions", error);
    return jsonServerError(
      "installation_instructions_failed",
      "Unexpected error while loading installation instructions.",
    );
  }
}
