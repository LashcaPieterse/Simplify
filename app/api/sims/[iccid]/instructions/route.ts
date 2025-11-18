import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  getInstallationInstructions,
  InstallationInstructionsError,
} from "@/lib/airalo/installInstructions";
import { isValidIccid, normalizeIccid } from "@/lib/esim/iccid";

const CACHE_TAG: string[] = ["airalo", "sims", "instructions"];
const CACHE_REVALIDATE_SECONDS = 60 * 30;

const getCachedInstructions = unstable_cache(
  async (iccid: string, language: string) =>
    getInstallationInstructions(iccid, { acceptLanguage: language }),
  CACHE_TAG,
  { revalidate: CACHE_REVALIDATE_SECONDS },
);

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

  try {
    const instructions = await getCachedInstructions(iccid, preferredLanguage);
    return NextResponse.json(instructions);
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
