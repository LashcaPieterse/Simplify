import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

test("editorial contract migration removes populated legacy tables and preserves catalogue, orders and sync history", { timeout: 60000 }, async (t) => {
  const sql = await PGlite.create();
  t.after(() => sql.close());
  // Generate the real application schema without connecting to any configured database.
  const baseline = spawnSync(process.execPath, [
    fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)),
    "migrate", "diff", "--from-empty", "--to-schema-datamodel",
    fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--script",
  ], { encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://fixture:fixture@localhost:5432/fixture" } });
  assert.equal(baseline.status, 0, baseline.stderr);
  await sql.exec(baseline.stdout);

  const foundation = readFileSync(new URL("../../prisma/migration-history/migrations/20260315110000_sync_audit_pricing_integrity/migration.sql", import.meta.url), "utf8");
  const legacyTables = foundation.match(/CREATE TABLE IF NOT EXISTS (?:pricing_audits|publishing_state) \([\s\S]*?\n\);/g);
  assert.equal(legacyTables?.length, 2);
  await sql.exec(legacyTables!.join("\n"));
  await sql.exec(`
    INSERT INTO countries (id, country_code, slug, title) VALUES ('11111111-1111-4111-8111-111111111111', 'NA', 'namibia', 'Namibia');
    INSERT INTO operators (id, country_id, title, info) VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Fixture carrier', '{}');
    INSERT INTO packages (id, operator_id, airalo_package_id, type, title, amount, data, day, manual_installation, qr_installation, price)
      VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'fixture-package', 'sim', 'Fixture plan', 1024, '1 GB', 7, '', '', 10);
    INSERT INTO "EsimOrder" (id, "packageId", status, quantity, "totalCents", currency, "updatedAt")
      VALUES ('fixture-order', '33333333-3333-4333-8333-333333333333', 'fulfilled', 1, 15000, 'NAD', NOW());
    INSERT INTO sync_runs (id, status, updated_at) VALUES ('fixture-run', 'success', NOW());
    INSERT INTO sync_run_items (id, run_id, entity_type, entity_key, action, warning_flags)
      VALUES ('fixture-item', 'fixture-run', 'package', 'fixture-package', 'insert', '{}');
    INSERT INTO entity_snapshots (id, run_id, entity_type, entity_key, raw_payload_json, normalized_json)
      VALUES ('fixture-snapshot', 'fixture-run', 'package', 'fixture-package', '{"price":10}', '{"price":10}');
    INSERT INTO publishing_state (package_airalo_id, published_price, published_currency)
      VALUES ('fixture-package', 10, 'USD');
    INSERT INTO pricing_audits (id, package_airalo_id, run_id, source_price, db_price, published_price, currency, delta_abs, delta_pct, severity)
      VALUES ('legacy-audit', 'fixture-package', 'fixture-run', 10, 11, 10, 'USD', 1, 10, 'high');
  `);
  const tables = ["countries", "operators", "packages", "EsimOrder", "sync_runs", "sync_run_items", "entity_snapshots"];
  const before = await Promise.all(tables.map(async (table) => (await sql.query(`SELECT * FROM "${table}"`)).rows));
  await sql.exec(readFileSync(new URL("../../prisma/migration-history/migrations/20261023120000_remove_editorial_publishing/migration.sql", import.meta.url), "utf8"));
  const retired = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('publishing_state', 'pricing_audits')");
  assert.deepEqual(retired.rows, []);
  for (let index = 0; index < tables.length; index++) {
    const table = tables[index];
    assert.deepEqual((await sql.query(`SELECT * FROM "${table}"`)).rows, before[index], `${table} must be preserved`);
  }
  await sql.exec("INSERT INTO sync_runs (id, status, updated_at) VALUES ('post-removal-run', 'success', NOW())");
  assert.equal((await sql.query("SELECT id FROM sync_runs")).rows.length, 2);
});
