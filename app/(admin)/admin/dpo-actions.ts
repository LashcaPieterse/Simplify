"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DpoSettingsError, saveDpoMode } from "@/lib/payments/dpo-settings";

export async function setDpoMode(mode: unknown) {
  const session = await requireAdminSession();
  try {
    const activeMode = await saveDpoMode(mode, session.email);
    revalidatePath("/admin");
    return { ok: true as const, activeMode, message: `DPO ${activeMode} payments are active for new checkouts.` };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof DpoSettingsError ? error.message : "Unable to change DPO mode. Refresh and try again.",
    };
  }
}
