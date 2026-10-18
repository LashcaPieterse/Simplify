BEGIN;
SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "EsimOrder" ADD COLUMN     "fulfilledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "affiliateCheckedAt" TIMESTAMP(3),
ADD COLUMN     "affiliateCode" TEXT,
ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "affiliateRateBps" INTEGER,
ADD COLUMN     "affiliateSource" TEXT;

-- CreateTable
CREATE TABLE "AffiliateProgramSettings" (
    "id" TEXT NOT NULL DEFAULT 'program',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRateBps" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProgramSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT,
    "promotion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rateOverrideBps" INTEGER,
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "saleCents" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "refundedSaleCents" INTEGER NOT NULL DEFAULT 0,
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "holdReason" TEXT,
    "fulfilledAt" TIMESTAMP(3) NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLedgerEntry" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "saleRefundCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateSaleAdjustment" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "saleRefundCents" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateSaleAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "period" TEXT NOT NULL,
    "note" TEXT,
    "preparedBy" TEXT NOT NULL,
    "transferReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "transferAmount" DECIMAL(20,6),
    "transferCurrency" TEXT,
    "exchangeRate" DECIMAL(20,10),
    "fees" DECIMAL(20,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayoutAllocation" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayoutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateNotification" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_code_key" ON "AffiliateProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_checkoutId_key" ON "AffiliateCommission"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_orderId_key" ON "AffiliateCommission"("orderId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_availableAt_idx" ON "AffiliateCommission"("affiliateId", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLedgerEntry_adjustmentId_key" ON "AffiliateLedgerEntry"("adjustmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLedgerEntry_idempotencyKey_key" ON "AffiliateLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AffiliateLedgerEntry_affiliateId_currency_availableAt_idx" ON "AffiliateLedgerEntry"("affiliateId", "currency", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSaleAdjustment_idempotencyKey_key" ON "AffiliateSaleAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AffiliateSaleAdjustment_checkoutId_createdAt_idx" ON "AffiliateSaleAdjustment"("checkoutId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_createdAt_idx" ON "AffiliatePayout"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayoutAllocation_ledgerEntryId_idx" ON "AffiliatePayoutAllocation"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "AffiliatePayoutAllocation_payoutId_idx" ON "AffiliatePayoutAllocation"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateNotification_idempotencyKey_key" ON "AffiliateNotification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AffiliateNotification_sentAt_nextAttemptAt_idx" ON "AffiliateNotification"("sentAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_affiliateId_createdAt_idx" ON "CheckoutSession"("affiliateId", "createdAt");

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "AffiliateSaleAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateSaleAdjustment" ADD CONSTRAINT "AffiliateSaleAdjustment_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutAllocation" ADD CONSTRAINT "AffiliatePayoutAllocation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutAllocation" ADD CONSTRAINT "AffiliatePayoutAllocation_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "AffiliateLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateNotification" ADD CONSTRAINT "AffiliateNotification_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A ledger entry may belong to only one unreleased payout, including under concurrency.
CREATE UNIQUE INDEX "AffiliatePayoutAllocation_active_entry_key"
ON "AffiliatePayoutAllocation" ("ledgerEntryId") WHERE "releasedAt" IS NULL;

ALTER TABLE "AffiliateProgramSettings" ADD CONSTRAINT "affiliate_settings_valid"
CHECK (id = 'program' AND ("defaultRateBps" IS NULL OR "defaultRateBps" BETWEEN 1 AND 10000) AND (NOT enabled OR "defaultRateBps" IS NOT NULL));
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "affiliate_profile_valid"
CHECK (status IN ('pending', 'approved', 'rejected', 'suspended') AND code ~ '^[A-Z0-9]{8,32}$' AND ("rateOverrideBps" IS NULL OR "rateOverrideBps" BETWEEN 1 AND 10000));
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "affiliate_checkout_snapshot_valid"
CHECK (("affiliateId" IS NULL AND "affiliateCode" IS NULL AND "affiliateRateBps" IS NULL AND "affiliateSource" IS NULL)
 OR ("affiliateId" IS NOT NULL AND "affiliateCode" IS NOT NULL AND "affiliateRateBps" IS NOT NULL AND "affiliateSource" IS NOT NULL
 AND "affiliateRateBps" BETWEEN 1 AND 10000 AND "affiliateSource" IN ('code', 'cookie') AND intent = 'purchase'));
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "affiliate_commission_valid"
CHECK ("saleCents" > 0 AND "rateBps" BETWEEN 1 AND 10000 AND "commissionCents" >= 0 AND "refundedSaleCents" BETWEEN 0 AND "saleCents"
 AND "commissionCents" = floor(("saleCents"::bigint * "rateBps" + 5000)::numeric / 10000)
 AND "availableAt" = "fulfilledAt" + interval '30 days');
ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "affiliate_ledger_valid"
CHECK ((kind = 'commission' AND "amountCents" >= 0 AND "saleRefundCents" = 0)
 OR (kind = 'refund' AND "amountCents" <= 0 AND "saleRefundCents" > 0 AND reference IS NOT NULL AND reason IS NOT NULL));
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "affiliate_payout_valid"
CHECK ("amountCents" > 0 AND status IN ('prepared', 'processing', 'paid', 'cancelled')
 AND (status <> 'paid' OR ("paidAt" IS NOT NULL AND "transferReference" IS NOT NULL AND "transferAmount" IS NOT NULL AND "transferAmount" > 0 AND "transferCurrency" IS NOT NULL AND "exchangeRate" IS NOT NULL AND "exchangeRate" > 0 AND fees IS NOT NULL AND fees >= 0)));

CREATE FUNCTION public.affiliate_immutable_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Affiliate ledger entries are append-only'; END;
$$;
CREATE TRIGGER affiliate_ledger_immutable BEFORE UPDATE OR DELETE ON "AffiliateLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION public.affiliate_immutable_ledger();

CREATE FUNCTION public.affiliate_frozen_checkout() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(OLD."affiliateId", OLD."affiliateCode", OLD."affiliateRateBps", OLD."affiliateSource")
    IS DISTINCT FROM ROW(NEW."affiliateId", NEW."affiliateCode", NEW."affiliateRateBps", NEW."affiliateSource")
    OR (OLD."affiliateId" IS NOT NULL AND ROW(OLD."totalCents", OLD.currency) IS DISTINCT FROM ROW(NEW."totalCents", NEW.currency)) THEN
    RAISE EXCEPTION 'Checkout affiliate terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER affiliate_checkout_immutable BEFORE UPDATE ON "CheckoutSession"
FOR EACH ROW EXECUTE FUNCTION public.affiliate_frozen_checkout();

CREATE FUNCTION public.affiliate_frozen_fulfilment() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD."fulfilledAt" IS NOT NULL AND OLD."fulfilledAt" IS DISTINCT FROM NEW."fulfilledAt" THEN
    RAISE EXCEPTION 'First fulfilment timestamp is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER affiliate_fulfilment_immutable BEFORE UPDATE ON "EsimOrder"
FOR EACH ROW EXECUTE FUNCTION public.affiliate_frozen_fulfilment();

CREATE FUNCTION public.affiliate_frozen_commission() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(OLD."affiliateId", OLD."checkoutId", OLD."orderId", OLD.currency, OLD."saleCents", OLD."rateBps", OLD."commissionCents", OLD."fulfilledAt", OLD."availableAt")
    IS DISTINCT FROM ROW(NEW."affiliateId", NEW."checkoutId", NEW."orderId", NEW.currency, NEW."saleCents", NEW."rateBps", NEW."commissionCents", NEW."fulfilledAt", NEW."availableAt") THEN
    RAISE EXCEPTION 'Original commission terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER affiliate_commission_immutable BEFORE UPDATE ON "AffiliateCommission"
FOR EACH ROW EXECUTE FUNCTION public.affiliate_frozen_commission();

ALTER TABLE "AffiliateSaleAdjustment" ADD CONSTRAINT "affiliate_sale_adjustment_valid" CHECK ("saleRefundCents" > 0);
ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "affiliate_ledger_adjustment_valid" CHECK ((kind = 'refund' AND "adjustmentId" IS NOT NULL) OR (kind = 'commission' AND "adjustmentId" IS NULL));
CREATE TRIGGER affiliate_sale_adjustment_immutable BEFORE UPDATE OR DELETE ON "AffiliateSaleAdjustment"
FOR EACH ROW EXECUTE FUNCTION public.affiliate_immutable_ledger();
ALTER TABLE "AffiliateSaleAdjustment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AffiliateSaleAdjustment" FROM PUBLIC, anon, authenticated;

-- Match the existing backend-only Supabase boundary. All reads/writes go through server authorization.
ALTER TABLE "AffiliateProgramSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateCommission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateLedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliatePayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliatePayoutAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateNotification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AffiliateProgramSettings", "AffiliateProfile", "AffiliateCommission", "AffiliateLedgerEntry", "AffiliatePayout", "AffiliatePayoutAllocation", "AffiliateNotification" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_immutable_ledger(), public.affiliate_frozen_checkout(), public.affiliate_frozen_fulfilment(), public.affiliate_frozen_commission() FROM PUBLIC, anon, authenticated;
INSERT INTO "AffiliateProgramSettings" (id, enabled, "updatedAt") VALUES ('program', false, CURRENT_TIMESTAMP);
COMMIT;
