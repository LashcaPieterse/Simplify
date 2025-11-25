-- CreateTable
CREATE TABLE "AiraloPackage" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "dataLimitMb" INTEGER,
    "validityDays" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "sellingPriceCents" INTEGER,
    "metadata" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "sourceHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "lastSyncJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiraloPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "requestId" TEXT,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentTransactionId" TEXT,

    CONSTRAINT "EsimOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimProfile" (
    "id" TEXT NOT NULL,
    "iccid" TEXT NOT NULL,
    "imsi" TEXT,
    "activationCode" TEXT,
    "status" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsimProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "usedMb" DOUBLE PRECISION,
    "remainingMb" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimOrderRecoveryAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EsimOrderRecoveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimInstallationPayload" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsimInstallationPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "intent" TEXT NOT NULL DEFAULT 'purchase',
    "topUpForOrderId" TEXT,
    "topUpForIccid" TEXT,
    "orderId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "transactionToken" TEXT,
    "redirectUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "statusHistory" TEXT,
    "metadata" TEXT,
    "checkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransactionEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransactionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiraloAccessToken" (
    "key" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiraloAccessToken_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsDeactivated" INTEGER NOT NULL DEFAULT 0,
    "diffPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiraloPackageTag" (
    "packageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "AiraloPackageTag_pkey" PRIMARY KEY ("packageId","tagId")
);

-- CreateTable
CREATE TABLE "PackageNote" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiraloPackage_externalId_key" ON "AiraloPackage"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_orderNumber_key" ON "EsimOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_requestId_key" ON "EsimOrder"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "EsimProfile_iccid_key" ON "EsimProfile"("iccid");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EsimInstallationPayload_orderId_key" ON "EsimInstallationPayload"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PackageTag_name_key" ON "PackageTag"("name");

-- AddForeignKey
ALTER TABLE "AiraloPackage" ADD CONSTRAINT "AiraloPackage_lastSyncJobId_fkey" FOREIGN KEY ("lastSyncJobId") REFERENCES "SyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimProfile" ADD CONSTRAINT "EsimProfile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSnapshot" ADD CONSTRAINT "UsageSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EsimProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSnapshot" ADD CONSTRAINT "UsageSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrderRecoveryAttempt" ADD CONSTRAINT "EsimOrderRecoveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimInstallationPayload" ADD CONSTRAINT "EsimInstallationPayload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransactionEvent" ADD CONSTRAINT "PaymentTransactionEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiraloPackageTag" ADD CONSTRAINT "AiraloPackageTag_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiraloPackageTag" ADD CONSTRAINT "AiraloPackageTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "PackageTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageNote" ADD CONSTRAINT "PackageNote_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiraloPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageNote" ADD CONSTRAINT "PackageNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

