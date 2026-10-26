-- CreateTable
CREATE TABLE "ReceiptDelivery" (
    "id" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "firstAttemptAt" TIMESTAMP(3),
    "acceptanceUnknown" BOOLEAN NOT NULL DEFAULT false,
    "providerMessageId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptDelivery_businessKey_key" ON "ReceiptDelivery"("businessKey");

-- CreateIndex
CREATE INDEX "ReceiptDelivery_status_nextAttemptAt_idx" ON "ReceiptDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ReceiptDelivery_orderId_idx" ON "ReceiptDelivery"("orderId");

-- AddForeignKey
ALTER TABLE "ReceiptDelivery" ADD CONSTRAINT "ReceiptDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ReceiptDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ReceiptDelivery" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "ReceiptDelivery" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "ReceiptDelivery" FROM authenticated; END IF;
END $$;
