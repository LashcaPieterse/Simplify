import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { verifyBaselineObjects, verifyMigrationArchive, BASELINE_NAME } from "../lib/db/provisioning";

async function main() {
  const url = new URL(process.env.TEST_POSTGRES_URL ?? "invalid:");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/simplify_remediation_test") throw new Error("Use only the isolated localhost simplify_remediation_test database.");
  const cli = resolve("node_modules/prisma/build/index.js");
  const run = (args: string[], connection: string) => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, DATABASE_URL: connection } });
    if (result.status !== 0) throw new Error(`Postgres fixture command failed: ${args.slice(0, 2).join(" ")}`);
    return result.stdout;
  };
  verifyMigrationArchive();
  const fresh = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const directory = mkdtempSync(join(tmpdir(), "simplify-postgres-"));
  const upgradeUrl = new URL(url);
  upgradeUrl.pathname = "/simplify_remediation_upgrade_test";
  let upgrade: PrismaClient | undefined;
  try {
    const existing = await fresh.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_tables WHERE schemaname='public'`;
    assert.equal(Number(existing[0].count), 0, "Fresh test database must be empty; never reset an existing database.");
    await fresh.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$`);
    run(["migrate", "deploy", "--schema", "prisma/schema.prisma"], url.toString());
    await verifyBaselineObjects(fresh);
    for (const role of ["anon", "authenticated"] as const) {
      await assert.rejects(fresh.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await tx.$queryRaw`SELECT id FROM public."User" LIMIT 1`;
      }), /permission denied/);
    }
    // Separate disposable upgrade database; no production URL or reset command is accepted.
    await fresh.$executeRawUnsafe('CREATE DATABASE "simplify_remediation_upgrade_test"');
    upgrade = new PrismaClient({ datasources: { db: { url: upgradeUrl.toString() } } });
    const legacy = run(["migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/migration-history/previous-schema.prisma", "--script"], upgradeUrl.toString());
    const baseline = readFileSync(`prisma/migrations/${BASELINE_NAME}/migration.sql`, "utf8");
    const extras = baseline.slice(baseline.indexOf("-- A ledger entry may belong"));
    const sqlFile = join(directory, "legacy.sql");
    writeFileSync(sqlFile, legacy + "\n" + extras);
    run(["db", "execute", "--schema", "prisma/schema.prisma", "--file", sqlFile], upgradeUrl.toString());
    await upgrade.$executeRawUnsafe(`INSERT INTO "User" (id,email,password_hash,"createdAt","updatedAt") VALUES ('preserved-user','fixture@example.test','preserved-hash',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
    const businessFixture = join(directory, "business-fixture.sql");
    writeFileSync(businessFixture, `
      INSERT INTO countries (id,country_code,slug,title) VALUES ('00000000-0000-0000-0000-000000000001','NA','fixture','Fixture');
      INSERT INTO operators (id,country_id,title) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Fixture');
      INSERT INTO packages (id,operator_id,airalo_package_id,type,title,amount,data,day,manual_installation,qr_installation,price)
        VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','fixture-package','sim','Fixture',1024,'1 GB',7,'','',10);
      INSERT INTO "CheckoutSession" (id,"userId","packageId","customerEmail","totalCents",currency,status,"updatedAt")
        VALUES ('preserved-checkout','preserved-user','00000000-0000-0000-0000-000000000003','fixture@example.test',1000,'NAD','paid',CURRENT_TIMESTAMP);
      INSERT INTO "PaymentTransaction" (id,"userId",provider,"dpoMode","checkoutId",status,"amountCents",currency,"updatedAt")
        VALUES ('preserved-payment','preserved-user','dpo','live','preserved-checkout','approved',1000,'NAD',CURRENT_TIMESTAMP);
      INSERT INTO "EsimOrder" (id,"orderNumber","userId","packageId",status,"customerEmail","totalCents",currency,"paymentTransactionId","updatedAt")
        VALUES ('preserved-order','fixture-supplier-order','preserved-user','00000000-0000-0000-0000-000000000003','completed','fixture@example.test',1000,'NAD','preserved-payment',CURRENT_TIMESTAMP);
      UPDATE "CheckoutSession" SET "orderId"='preserved-order' WHERE id='preserved-checkout';
    `);
    run(["db", "execute", "--schema", "prisma/schema.prisma", "--file", businessFixture], upgradeUrl.toString());
    const businessBefore = await upgrade.$queryRaw`SELECT c.id, c."orderId", o."orderNumber", o.status, p."dpoMode", p."amountCents", p.currency, p."checkoutId"
      FROM "CheckoutSession" c JOIN "EsimOrder" o ON o.id=c."orderId" JOIN "PaymentTransaction" p ON p.id=o."paymentTransactionId"`;
    run(["migrate", "resolve", "--applied", "20251125125639_init_postgres", "--schema", "prisma/migration-history/schema.prisma"], upgradeUrl.toString());
    const before = await upgrade.$queryRaw`SELECT id,email,password_hash,"createdAt","updatedAt" FROM "User"`;
    for (const name of ["20261023130000_identity_proof", "20261023140000_payment_lifecycle", "20261023150000_receipt_outbox"]) {
      run(["db", "execute", "--schema", "prisma/schema.prisma", "--file", `prisma/migration-history/migrations/${name}/migration.sql`], upgradeUrl.toString());
    }
    assert.deepEqual(await upgrade.$queryRaw`SELECT id,email,password_hash,"createdAt","updatedAt" FROM "User"`, before);
    await verifyBaselineObjects(upgrade);
    const parity = spawnSync(process.execPath, [cli, "migrate", "diff", "--from-schema-datasource", "prisma/migration-history/schema.prisma", "--to-schema-datamodel", "prisma/migration-history/schema.prisma", "--exit-code"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: upgradeUrl.toString() } });
    assert.equal(parity.status, 0, "Upgrade must match the frozen schema.");
    run(["migrate", "resolve", "--applied", BASELINE_NAME], upgradeUrl.toString());
    run(["migrate", "deploy"], upgradeUrl.toString());
    assert.equal(await upgrade.user.count(), 1);
    assert.deepEqual(await upgrade.$queryRaw`SELECT c.id, c."orderId", o."orderNumber", o.status, p."dpoMode", p."amountCents", p.currency, p."checkoutId"
      FROM "CheckoutSession" c JOIN "EsimOrder" o ON o.id=c."orderId" JOIN "PaymentTransaction" p ON p.id=o."paymentTransactionId"`, businessBefore);
    const history = await upgrade.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations"`;
    assert.ok(history.some(row => row.migration_name === "20251125125639_init_postgres"), "Historical migration records must survive adoption.");
    assert.equal((await upgrade.user.findUniqueOrThrow({ where: { id: "preserved-user" } })).emailProofAt, null);
    console.log("Real Postgres fresh baseline, upgrade, parity and preserved-record checks passed.");
  } finally {
    if (upgrade) await upgrade.$disconnect();
    await fresh.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Postgres migration test failed."); process.exitCode = 1; });
