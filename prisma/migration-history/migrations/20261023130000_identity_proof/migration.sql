
-- AlterTable
ALTER TABLE "EsimOrder" ADD COLUMN     "accessVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "accessVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailProofAt" TIMESTAMP(3),
ADD COLUMN     "emailProofSource" TEXT,
ADD COLUMN     "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recoveryRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserIdentity" ADD COLUMN     "quarantined" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EsimOrder_userId_createdAt_idx" ON "EsimOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EsimOrder_status_updatedAt_idx" ON "EsimOrder"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "EsimProfile_orderId_idx" ON "EsimProfile"("orderId");

-- CreateIndex
CREATE INDEX "EsimOrderRecoveryAttempt_orderId_createdAt_idx" ON "EsimOrderRecoveryAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_checkoutId_createdAt_idx" ON "PaymentTransaction"("checkoutId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_transactionToken_idx" ON "PaymentTransaction"("transactionToken");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerReference_idx" ON "PaymentTransaction"("providerReference");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_updatedAt_idx" ON "PaymentTransaction"("status", "updatedAt");

