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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiraloAccessToken" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiraloAccessToken" ("createdAt", "expiresAt", "key", "token", "updatedAt") SELECT "createdAt", "expiresAt", "key", "token", "updatedAt" FROM "AiraloAccessToken";
DROP TABLE "AiraloAccessToken";
ALTER TABLE "new_AiraloAccessToken" RENAME TO "AiraloAccessToken";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
