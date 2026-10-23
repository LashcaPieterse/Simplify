BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TYPE "DpoMode" AS ENUM ('test', 'live');

CREATE TABLE "DpoSettings" (
    "id" TEXT NOT NULL DEFAULT 'dpo',
    "activeMode" "DpoMode" NOT NULL DEFAULT 'test',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DpoSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DpoSettings_singleton" CHECK ("id" = 'dpo')
);

INSERT INTO "DpoSettings" ("id", "activeMode", "updatedAt")
VALUES ('dpo', 'test', CURRENT_TIMESTAMP);

ALTER TABLE "PaymentTransaction" ADD COLUMN "dpoMode" "DpoMode";

-- All DPO payments created before this migration used the existing test account.
UPDATE "PaymentTransaction" SET "dpoMode" = 'test' WHERE "provider" = 'dpo';

ALTER TABLE "DpoSettings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DpoSettings" FROM PUBLIC, anon, authenticated;

COMMIT;
