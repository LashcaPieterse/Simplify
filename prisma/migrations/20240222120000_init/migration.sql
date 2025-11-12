-- CreateTable
CREATE TABLE "AiraloPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "region" TEXT,
    "dataLimitMb" INTEGER,
    "validityDays" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AiraloPackage_externalId_key" ON "AiraloPackage"("externalId");

-- CreateTable
CREATE TABLE "EsimOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerEmail" TEXT,
    "totalCents" INTEGER,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EsimOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_orderNumber_key" ON "EsimOrder"("orderNumber");

-- CreateTable
CREATE TABLE "EsimProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iccid" TEXT NOT NULL,
    "imsi" TEXT,
    "activationCode" TEXT,
    "status" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EsimProfile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EsimProfile_iccid_key" ON "EsimProfile"("iccid");

-- CreateTable
CREATE TABLE "UsageSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "usedMb" REAL,
    "remainingMb" REAL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EsimProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "WebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
