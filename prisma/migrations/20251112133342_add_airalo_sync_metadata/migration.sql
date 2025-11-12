-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiraloPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "region" TEXT,
    "dataLimitMb" INTEGER,
    "validityDays" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "metadata" TEXT,
    "lastSyncedAt" DATETIME,
    "sourceHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiraloPackage" ("createdAt", "currency", "dataLimitMb", "description", "externalId", "id", "name", "priceCents", "region", "updatedAt", "validityDays") SELECT "createdAt", "currency", "dataLimitMb", "description", "externalId", "id", "name", "priceCents", "region", "updatedAt", "validityDays" FROM "AiraloPackage";
DROP TABLE "AiraloPackage";
ALTER TABLE "new_AiraloPackage" RENAME TO "AiraloPackage";
CREATE UNIQUE INDEX "AiraloPackage_externalId_key" ON "AiraloPackage"("externalId");
CREATE TABLE "new_EsimOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerEmail" TEXT,
    "totalCents" INTEGER,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EsimOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EsimOrder" ("createdAt", "currency", "customerEmail", "id", "orderNumber", "packageId", "status", "totalCents", "updatedAt") SELECT "createdAt", "currency", "customerEmail", "id", "orderNumber", "packageId", "status", "totalCents", "updatedAt" FROM "EsimOrder";
DROP TABLE "EsimOrder";
ALTER TABLE "new_EsimOrder" RENAME TO "EsimOrder";
CREATE UNIQUE INDEX "EsimOrder_orderNumber_key" ON "EsimOrder"("orderNumber");
CREATE TABLE "new_EsimProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iccid" TEXT NOT NULL,
    "imsi" TEXT,
    "activationCode" TEXT,
    "status" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EsimProfile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EsimProfile" ("activatedAt", "activationCode", "createdAt", "expiresAt", "iccid", "id", "imsi", "orderId", "status", "updatedAt") SELECT "activatedAt", "activationCode", "createdAt", "expiresAt", "iccid", "id", "imsi", "orderId", "status", "updatedAt" FROM "EsimProfile";
DROP TABLE "EsimProfile";
ALTER TABLE "new_EsimProfile" RENAME TO "EsimProfile";
CREATE UNIQUE INDEX "EsimProfile_iccid_key" ON "EsimProfile"("iccid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
