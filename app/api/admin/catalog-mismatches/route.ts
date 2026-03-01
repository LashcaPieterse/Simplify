import { NextResponse } from "next/server";

import { getCatalogMismatches } from "@/lib/catalog/mismatches";

export async function GET() {
  const mismatches = await getCatalogMismatches();
  if (mismatches.length > 0) {
    console.warn(`[catalog-mismatch] Detected ${mismatches.length} mismatched products.`);
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: mismatches.length,
    mismatches,
  });
}
