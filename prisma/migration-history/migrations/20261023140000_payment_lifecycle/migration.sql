
-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "providerCode" TEXT,
ADD COLUMN     "providerExplanation" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PaymentTransactionEvent" ADD COLUMN     "fromStatus" TEXT,
ADD COLUMN     "toStatus" TEXT,
ADD COLUMN     "transitionVersion" INTEGER;

-- CreateTable
CREATE TABLE "LifecycleJob" (
    "id" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleJob_businessKey_key" ON "LifecycleJob"("businessKey");

-- CreateIndex
CREATE INDEX "LifecycleJob_status_nextAttemptAt_idx" ON "LifecycleJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransactionEvent_transactionId_transitionVersion_key" ON "PaymentTransactionEvent"("transactionId", "transitionVersion");


ALTER TABLE "LifecycleJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "LifecycleJob" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "LifecycleJob" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "LifecycleJob" FROM authenticated; END IF;
END $$;
