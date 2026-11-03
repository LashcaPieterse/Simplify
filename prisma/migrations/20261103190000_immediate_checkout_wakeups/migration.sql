-- Additive only: preserve existing jobs, leases, receipts and business records.
ALTER TABLE "LifecycleJob"
  ADD COLUMN "wakeVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "ReceiptDelivery"
  ADD COLUMN "wakeVersion" INTEGER NOT NULL DEFAULT 0;
