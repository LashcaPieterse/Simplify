-- Align UserIdentity with current Prisma schema for NextAuth
ALTER TABLE "UserIdentity"
    ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'oauth',
    ADD COLUMN IF NOT EXISTS "accessToken" TEXT,
    ADD COLUMN IF NOT EXISTS "refreshToken" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" INTEGER,
    ADD COLUMN IF NOT EXISTS "idToken" TEXT,
    ADD COLUMN IF NOT EXISTS "scope" TEXT,
    ADD COLUMN IF NOT EXISTS "tokenType" TEXT,
    ADD COLUMN IF NOT EXISTS "sessionState" TEXT;

-- Ensure VerificationToken table exists for email/magic-link auth
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token")
);

-- Token must be unique across identifiers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'VerificationToken_token_key'
    ) THEN
        CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
    END IF;
END;
$$;
