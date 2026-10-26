import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import prisma from "../lib/db/client";
import { BASELINE_NAME, verifyMigrationArchive, verifyBaselineObjects } from "../lib/db/provisioning";

async function main() {
  const archiveFiles = verifyMigrationArchive();
  const schema = "prisma/migration-history/schema.prisma";
  const cli = resolve("node_modules/prisma/build/index.js");
  const diff = spawnSync(process.execPath, [cli, "migrate", "diff", "--from-schema-datasource", schema, "--to-schema-datamodel", schema, "--exit-code"], { encoding: "utf8" });
  if (diff.status !== 0) throw new Error("Schema differs from the frozen baseline. Apply the staged additive upgrades or resolve drift before adoption.");
  await verifyBaselineObjects(prisma);
  console.log(JSON.stringify({ action: "baseline-parity-confirmed", archiveFiles, apply: process.argv.includes("--apply") }));
  if (!process.argv.includes("--apply")) return;
  const result = spawnSync(process.execPath, [cli, "migrate", "resolve", "--applied", BASELINE_NAME], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Baseline registration failed.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Baseline adoption failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
