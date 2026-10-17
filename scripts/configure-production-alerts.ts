import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: [] });

async function main() {
  const configure = process.argv.includes("--configure");
  const activate = process.argv.includes("--activate");
  if (configure === activate) throw new Error("Choose --configure (inactive setup) or --activate after deployment.");
  if (configure) {
    const key = process.env.RESEND_API_KEY?.trim();
    const recipient = process.env.PRODUCTION_ALERT_EMAIL?.trim();
    if (!key || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Configure RESEND_API_KEY and a valid PRODUCTION_ALERT_EMAIL.");
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('configure-production-alerts')::bigint)::text`;
      const existing = await tx.$queryRaw<Array<{ matches: boolean }>>`
        SELECT decrypted_secret = ${key} AS matches FROM vault.decrypted_secrets WHERE name = 'operations_alert_resend_key'`;
      if (existing.length && (existing.length !== 1 || !existing[0].matches)) throw new Error("Existing Vault email key differs; reconcile it explicitly before continuing.");
      if (!existing.length) await tx.$queryRaw`SELECT vault.create_secret(${key}::text, 'operations_alert_resend_key'::text, 'Existing Resend key for production monitor fallback'::text)`;
      await tx.$executeRaw`INSERT INTO recovery_ops.alert_config (recipient, sender) VALUES (${recipient}, 'alerts@sim.africa')
        ON CONFLICT (singleton) DO UPDATE SET recipient = EXCLUDED.recipient, sender = EXCLUDED.sender`;
    }, { timeout: 15000 });
    console.info("Production alert recipient and encrypted fallback key configured; scheduler activation is separate.");
  } else {
    await db.$transaction(async tx => {
      const ready = await tx.$queryRaw<Array<{ ready: boolean }>>`SELECT
        EXISTS (SELECT 1 FROM recovery_ops.alert_config WHERE singleton) AND
        EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'operations_alert_resend_key') AND
        EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'airalo_recovery_cron_token') AND
        NOT EXISTS (SELECT 1 FROM recovery_ops.production_alerts WHERE alert_key LIKE 'ops-integration-%') AS ready`;
      if (!ready[0]?.ready) throw new Error("Monitor configuration is incomplete or integration fixtures remain.");
      await tx.$executeRaw`UPDATE recovery_ops.alert_config SET enabled = true, activated_at = CASE WHEN enabled THEN activated_at ELSE now() END WHERE singleton`;
      const jobs = await tx.$queryRaw<Array<{ altered: string }>>`SELECT cron.alter_job(jobid, active := true)::text AS altered
        FROM cron.job WHERE jobname = 'production-alert-monitor'`;
      if (jobs.length !== 1) throw new Error("Expected exactly one production alert monitor job.");
    });
    console.info("Production alert monitor enabled.");
  }
}

main().catch(() => {
  // Prisma/provider errors can include parameters. Never print the email key.
  console.error("Production alert configuration failed. Check prerequisites without printing secrets.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
