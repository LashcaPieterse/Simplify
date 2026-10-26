import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import prisma from "../lib/db/client";
import { platformFiles, verifyFunctions, verifyBaselineObjects } from "../lib/db/provisioning";

async function main() {
  const apply = process.argv.includes("--apply");
  const files = platformFiles();
  console.log(JSON.stringify({ action: "platform-inventory", files, apply }));
  if (!apply) return;
  for (const file of files) {
    const path = resolve("prisma/platform", file);
    const sql = readFileSync(path, "utf8");
    if (file.startsWith("001")) {
      // Privilege changes are intentionally repeatable.
    } else {
      const functionName = file.startsWith("002") ? "run_airalo_recovery" : "run_production_monitor";
      const existing = await prisma.$queryRaw<Array<{ present: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='recovery_ops' AND p.proname=${functionName}) AS present`;
      if (existing[0]?.present) { await verifyFunctions(prisma, sql); continue; }
    }
    const result = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "execute", "--file", path, "--schema", "prisma/schema.prisma"], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`Platform bootstrap stopped at ${file}.`);
    await verifyFunctions(prisma, sql);
  }
  await verifyBaselineObjects(prisma);
  console.log("Platform definitions and backend access verified. Fresh schedulers remain inactive; provision Vault secrets and verify before activation.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Platform bootstrap failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
