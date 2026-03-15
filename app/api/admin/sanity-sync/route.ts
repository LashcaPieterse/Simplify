import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/guards";
import { syncCatalogToSanity } from "@/lib/sanity/sync-catalog";

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncCatalogToSanity();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sanity sync failed.";
    console.error("[sanity-sync] Admin sync failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
