import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

export const BASELINE_NAME = "20261023170000_security_baseline";

export function verifyMigrationArchive(root = process.cwd()) {
  const directory = resolve(root, "prisma/migration-history");
  const manifest = JSON.parse(readFileSync(resolve(directory, "checksums.json"), "utf8")) as Record<string, string>;
  for (const [path, hash] of Object.entries(manifest)) {
    const actual = createHash("sha256").update(readFileSync(resolve(directory, "migrations", path))).digest("hex");
    if (actual !== hash) throw new Error(`Archived migration checksum mismatch: ${path}`);
  }
  return Object.keys(manifest).length;
}

export function functionBodies(sql: string) {
  const bodies = new Map<string, string>();
  for (const match of Array.from(sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+)\.([a-z_]+)\([^]*?\bAS\s+(\$[a-z_]*\$)([^]*?)\3\s*;/gi))) {
    bodies.set(`${match[1]}.${match[2]}`, match[4].replace(/\s+/g, " ").trim());
  }
  return bodies;
}

export async function verifyFunctions(db: PrismaClient, sql: string) {
  for (const [name, expected] of Array.from(functionBodies(sql))) {
    const [schema, functionName] = name.split(".");
    const rows = await db.$queryRaw<Array<{ body: string; settings: string[] | null; securityDefiner: boolean }>>`
      SELECT p.prosrc AS body, p.proconfig AS settings, p.prosecdef AS "securityDefiner"
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = ${schema} AND p.proname = ${functionName}`;
    if (rows.length !== 1 || rows[0].body.replace(/\s+/g, " ").trim() !== expected || rows[0].securityDefiner || !rows[0].settings?.includes("search_path=pg_catalog")) {
      throw new Error(`Function parity failed: ${name}`);
    }
  }
}

export async function verifyBaselineObjects(db: PrismaClient, root = process.cwd()) {
  const sql = readFileSync(resolve(root, `prisma/migrations/${BASELINE_NAME}/migration.sql`), "utf8");
  await verifyFunctions(db, sql);
  type Definition = { name: string; definition: string };
  const expected = JSON.parse(readFileSync(resolve(root, "prisma/baseline-objects.json"), "utf8")) as Record<"checks" | "triggers" | "indexes", Definition[]>;
  const checks = await db.$queryRaw<Array<Definition & { validated: boolean }>>`
    SELECT conname AS name, pg_get_constraintdef(oid) AS definition, convalidated AS validated
    FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace`;
  const triggers = await db.$queryRaw<Array<Definition & { enabled: string }>>`
    SELECT tgname AS name, pg_get_triggerdef(t.oid) AS definition, tgenabled AS enabled
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT tgisinternal AND n.nspname='public'`;
  const indexes = await db.$queryRaw<Array<Definition & { valid: boolean }>>`
    SELECT i.indexrelid::regclass::text AS name, pg_get_indexdef(i.indexrelid) AS definition, i.indisvalid AS valid
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE i.indpred IS NOT NULL AND n.nspname='public'`;
  const canonical = (value: string) => value.replace(/\s+/g, " ").trim();
  for (const kind of ["checks", "triggers", "indexes"] as const) {
    const actual = { checks, triggers, indexes }[kind];
    for (const definition of expected[kind]) {
      const object = actual.find(candidate => candidate.name === definition.name);
      if (!object || canonical(object.definition) !== canonical(definition.definition)
        || ("validated" in object && !object.validated) || ("enabled" in object && object.enabled !== "O")
        || ("valid" in object && !object.valid)) throw new Error(`Baseline ${kind} parity failed: ${definition.name}`);
    }
  }
  const insecure = await db.$queryRaw<Array<{ name: string }>>`
    SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations' AND NOT c.relrowsecurity`;
  if (insecure.length) throw new Error("Baseline tables must have RLS enabled.");
  const permissions = await db.$queryRaw<Array<{ role: string }>>`
    SELECT rolname AS role FROM pg_roles WHERE rolname IN ('anon', 'authenticated') AND
    (has_schema_privilege(oid, 'public', 'USAGE') OR EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p') AND has_table_privilege(pg_roles.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))`;
  if (permissions.length) throw new Error("Client roles retain backend schema/table access.");
}

export function platformFiles(root = process.cwd()) {
  return readdirSync(resolve(root, "prisma/platform")).filter(file => file.endsWith(".sql")).sort();
}
