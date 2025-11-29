-- Allow inserting packages without providing the legacy `price` column.
-- Prisma only writes `price_cents`, so we set a default on `price` to prevent
-- NOT NULL violations when the column is omitted.
ALTER TABLE "packages"
  ALTER COLUMN "price" SET DEFAULT 0;
