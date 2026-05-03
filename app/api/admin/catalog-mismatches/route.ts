import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/guards";
import { getCatalogMismatches } from "@/lib/catalog/mismatches";

export async function GET(request: NextRequest) {
  if (!(await requireAdminApiSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
