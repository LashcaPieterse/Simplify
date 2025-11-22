import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

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
    return NextResponse.json(
      { message: "An ICCID is required to look up installation instructions." },
      { status: 400 },
    );
  }

  if (!isValidIccid(iccid)) {
    return NextResponse.json(
      { message: "Enter a valid ICCID before requesting installation instructions." },
      { status: 422 },
    );
  }

  const preferredLanguage = extractPreferredLanguage(
    request.headers.get("accept-language"),
  );

  const simDetailsPromise = getSimDetails(iccid, { include: ["simable"] }).catch(
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
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to load installation instructions", error);
    return NextResponse.json(
      { message: "Unexpected error while loading installation instructions." },
      { status: 500 },
    );
  }
}
