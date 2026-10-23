import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { verifyBaselineObjects } from "../lib/db/provisioning";

async function main() {
  const url = new URL(process.env.TEST_SUPABASE_URL ?? "invalid:");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "54322" || url.pathname !== "/postgres") {
    throw new Error("Use only a disposable local Supabase database on localhost:54322/postgres.");
  }
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const existing = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='User'`;
    assert.equal(Number(existing[0].count), 0, "Use a fresh disposable Supabase instance; no reset is performed.");
    const run = (file: string, args: string[]) => {
      const result = spawnSync(process.execPath, [resolve(file), ...args], { encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString() } });
      if (result.status !== 0) throw new Error(`Isolated platform fixture failed: ${file}`);
    };
    run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
    run("node_modules/tsx/dist/cli.mjs", ["scripts/db-platform.ts", "--apply"]);
    await verifyBaselineObjects(db);
    const extensions = await db.$queryRaw<Array<{ name: string }>>`SELECT extname AS name FROM pg_extension WHERE extname IN ('pg_cron','http','supabase_vault')`;
    assert.equal(extensions.length, 3);
    const jobs = await db.$queryRaw<Array<{ jobname: string; active: boolean; command: string }>>`SELECT jobname, active, command FROM cron.job WHERE jobname IN ('airalo-order-recovery','production-alert-monitor')`;
    assert.equal(jobs.length, 2);
    assert.ok(jobs.every(job => !job.active && /^select recovery_ops\.[a-z_]+\(\);$/.test(job.command)));
    const secrets = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM vault.decrypted_secrets WHERE name IN ('airalo_recovery_cron_token','operations_alert_resend_key')`;
    assert.equal(Number(secrets[0].count), 0, "Provisioning must not install embedded secrets.");
    for (const role of ["anon", "authenticated"] as const) {
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await tx.$queryRaw`SELECT id FROM public."User" LIMIT 1`;
      }), /permission denied/);
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await tx.$queryRaw`SELECT id FROM recovery_ops.http_requests LIMIT 1`;
      }), /permission denied/);
    }
    console.log("Supabase extensions, inactive schedulers, absent secrets and denied client roles verified.");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Platform test failed."); process.exitCode = 1; });
