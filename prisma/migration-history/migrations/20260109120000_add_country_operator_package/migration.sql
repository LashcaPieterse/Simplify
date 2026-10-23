-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create countries table
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "countries_country_code_key" UNIQUE ("country_code"),
    CONSTRAINT "countries_slug_key" UNIQUE ("slug")
);

-- Create operators table
CREATE TABLE "operators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "api_operator_id" INTEGER,
    "operator_code" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operators_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operators_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "operators_country_id_idx" ON "operators"("country_id");

-- Create packages table
CREATE TABLE "packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data_amount_mb" INTEGER,
    "validity_days" INTEGER,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "price" NUMERIC(10, 2) NOT NULL,
    "currency_code" TEXT DEFAULT 'USD',
    "short_info" TEXT,
    "qr_installation" TEXT,
    "manual_installation" TEXT,
    "is_fair_usage_policy" BOOLEAN,
    "fair_usage_policy" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "packages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "packages_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "packages_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "packages_country_id_idx" ON "packages"("country_id");
CREATE INDEX "packages_operator_id_idx" ON "packages"("operator_id");
