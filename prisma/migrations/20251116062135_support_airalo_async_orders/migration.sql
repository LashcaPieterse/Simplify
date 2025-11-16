-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EsimOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT,
    "requestId" TEXT,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paymentTransactionId" TEXT,
    CONSTRAINT "EsimOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EsimOrder_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EsimOrder" ("createdAt", "currency", "customerEmail", "id", "orderNumber", "packageId", "paymentTransactionId", "quantity", "status", "totalCents", "updatedAt") SELECT "createdAt", "currency", "customerEmail", "id", "orderNumber", "packageId", "paymentTransactionId", "quantity", "status", "totalCents", "updatedAt" FROM "EsimOrder";
DROP TABLE "EsimOrder";
ALTER TABLE "new_EsimOrder" RENAME TO "EsimOrder";
CREATE UNIQUE INDEX "EsimOrder_orderNumber_key" ON "EsimOrder"("orderNumber");
CREATE UNIQUE INDEX "EsimOrder_requestId_key" ON "EsimOrder"("requestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
