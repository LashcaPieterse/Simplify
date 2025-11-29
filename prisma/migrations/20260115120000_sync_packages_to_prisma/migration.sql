-- Align packages table with Prisma schema
ALTER TABLE "packages"
  ADD COLUMN IF NOT EXISTS "price_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "selling_price_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMPTZ;

-- Ensure external_id is unique as required by the Prisma schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'packages_external_id_key'
  ) THEN
    ALTER TABLE "packages" ADD CONSTRAINT "packages_external_id_key" UNIQUE ("external_id");
  END IF;
END
$$;
