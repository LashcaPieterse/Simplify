-- Repoint checkout/order package foreign keys to the canonical packages table,
-- then remove legacy AiraloPackage-related tables.

ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "packageId_new" uuid;

UPDATE "CheckoutSession" cs
SET "packageId_new" = COALESCE(
  CASE
    WHEN cs."packageId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (cs."packageId"::text)::uuid
    ELSE NULL
  END,
  p.id
)
FROM packages p
WHERE p.external_id = cs."packageId"::text
   OR p.id::text = cs."packageId"::text;

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "CheckoutSession" WHERE "packageId_new" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'CheckoutSession has % rows with unmapped packageId values', missing_count;
  END IF;
END $$;

ALTER TABLE "CheckoutSession" DROP CONSTRAINT IF EXISTS "CheckoutSession_packageId_fkey";
ALTER TABLE "CheckoutSession" DROP COLUMN IF EXISTS "packageId";
ALTER TABLE "CheckoutSession" RENAME COLUMN "packageId_new" TO "packageId";
ALTER TABLE "CheckoutSession" ALTER COLUMN "packageId" SET NOT NULL;
ALTER TABLE "CheckoutSession"
  ADD CONSTRAINT "CheckoutSession_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES public.packages(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CheckoutSession_packageId_idx" ON "CheckoutSession" ("packageId");

ALTER TABLE "EsimOrder" ADD COLUMN IF NOT EXISTS "packageId_new" uuid;

UPDATE "EsimOrder" eo
SET "packageId_new" = COALESCE(
  CASE
    WHEN eo."packageId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (eo."packageId"::text)::uuid
    ELSE NULL
  END,
  p.id
)
FROM packages p
WHERE p.external_id = eo."packageId"::text
   OR p.id::text = eo."packageId"::text;

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "EsimOrder" WHERE "packageId_new" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'EsimOrder has % rows with unmapped packageId values', missing_count;
  END IF;
END $$;

ALTER TABLE "EsimOrder" DROP CONSTRAINT IF EXISTS "EsimOrder_packageId_fkey";
ALTER TABLE "EsimOrder" DROP COLUMN IF EXISTS "packageId";
ALTER TABLE "EsimOrder" RENAME COLUMN "packageId_new" TO "packageId";
ALTER TABLE "EsimOrder" ALTER COLUMN "packageId" SET NOT NULL;
ALTER TABLE "EsimOrder"
  ADD CONSTRAINT "EsimOrder_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES public.packages(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "EsimOrder_packageId_idx" ON "EsimOrder" ("packageId");

DO $$
DECLARE airalo_count integer;
BEGIN
  IF to_regclass('public."AiraloPackage"') IS NOT NULL THEN
    SELECT COUNT(*) INTO airalo_count FROM "AiraloPackage";
    IF airalo_count > 0 THEN
      RAISE EXCEPTION 'Refusing to drop AiraloPackage: table contains % rows', airalo_count;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS "AiraloPackageTag";
DROP TABLE IF EXISTS "PackageNote";
DROP TABLE IF EXISTS "PackageTag";
DROP TABLE IF EXISTS "AiraloPackage";
