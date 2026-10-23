-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "quoteId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredCurrency" TEXT;

-- CreateTable
CREATE TABLE "CheckoutQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionHash" TEXT,
    "packageId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "intent" TEXT NOT NULL,
    "topUpForOrderId" TEXT,
    "topUpForIccid" TEXT,
    "displayCents" INTEGER NOT NULL,
    "displayCurrency" TEXT NOT NULL,
    "sourceZarCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NAD',
    "catalogSnapshot" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckoutQuote_expiresAt_idx" ON "CheckoutQuote"("expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutQuote_userId_idx" ON "CheckoutQuote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_quoteId_key" ON "CheckoutSession"("quoteId");

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_preferredCurrency_check"
  CHECK ("preferredCurrency" IS NULL OR "preferredCurrency" IN ('USD', 'NAD', 'ZAR', 'EUR', 'GBP'));
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_amounts_check"
  CHECK ("quantity" = 1 AND "currency" = 'NAD' AND "sourceZarCents" > 0
    AND "totalCents" = "sourceZarCents" AND "displayCents" > 0
    AND "displayCurrency" IN ('USD', 'NAD', 'ZAR', 'EUR', 'GBP'));

-- Quotes are private backend records; application routes enforce ownership.
ALTER TABLE "CheckoutQuote" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "CheckoutQuote" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "CheckoutQuote" FROM authenticated;
  END IF;
END $$;
