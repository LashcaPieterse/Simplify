-- CreateTable
CREATE TABLE "EsimInstallationPayload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EsimInstallationPayload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EsimOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EsimInstallationPayload_orderId_key" ON "EsimInstallationPayload"("orderId");
