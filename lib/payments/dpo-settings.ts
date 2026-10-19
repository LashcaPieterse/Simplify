import type { DpoMode, PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { getDpoCredentialStatus, isDpoMode } from "./dpo";

export class DpoSettingsError extends Error {}

export async function getActiveDpoMode(db: PrismaClient = prisma): Promise<DpoMode> {
  const settings = await db.dpoSettings.findUnique({ where: { id: "dpo" } });
  if (!settings || !isDpoMode(settings.activeMode)) {
    throw new DpoSettingsError("DPO payment settings are unavailable. Apply the DPO gateway migration.");
  }
  return settings.activeMode;
}

export async function saveDpoMode(rawMode: unknown, actorEmail: string, db: PrismaClient = prisma): Promise<DpoMode> {
  if (!isDpoMode(rawMode)) {
    throw new DpoSettingsError("Choose test or live payments.");
  }
  if (!getDpoCredentialStatus()[rawMode]) {
    throw new DpoSettingsError(`DPO ${rawMode} credentials are not fully configured.`);
  }

  return db.$transaction(async tx => {
    // Serialize switches so every audit entry records the actual preceding mode.
    const [settings] = await tx.$queryRaw<Array<{ activeMode: DpoMode }>>`
      SELECT "activeMode" FROM "DpoSettings" WHERE "id" = 'dpo' FOR UPDATE
    `;
    if (!settings) {
      throw new DpoSettingsError("DPO payment settings are unavailable. Apply the DPO gateway migration.");
    }
    if (settings.activeMode === rawMode) return rawMode;

    await tx.dpoSettings.update({ where: { id: "dpo" }, data: { activeMode: rawMode } });
    await tx.auditLog.create({
      data: {
        action: "payments.dpo.mode-changed",
        entityType: "DpoSettings",
        entityId: "dpo",
        details: JSON.stringify({ previousMode: settings.activeMode, mode: rawMode, actorEmail }),
      },
    });
    return rawMode;
  });
}
