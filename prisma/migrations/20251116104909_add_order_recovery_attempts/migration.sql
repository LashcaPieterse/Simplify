-- CreateTable
CREATE TABLE "EsimOrderRecoveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EsimOrderRecoveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Note: AiraloAccessToken is created in migration 20251118120000_add_airalo_token_cache.
-- This migration no longer redefines that table to keep the sequence bootstrap-friendly on fresh DBs.
