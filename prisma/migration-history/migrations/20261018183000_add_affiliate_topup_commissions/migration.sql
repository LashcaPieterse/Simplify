BEGIN;
SET LOCAL lock_timeout = '5s';

-- Existing checkout snapshots remain immutable and are never backfilled.
-- A top-up's attribution comes only from the original eSIM, never a browser code/cookie.
ALTER TABLE "CheckoutSession" DROP CONSTRAINT "affiliate_checkout_snapshot_valid";
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "affiliate_checkout_snapshot_valid"
CHECK (("affiliateId" IS NULL AND "affiliateCode" IS NULL AND "affiliateRateBps" IS NULL AND "affiliateSource" IS NULL)
 OR ("affiliateId" IS NOT NULL AND "affiliateCode" IS NOT NULL AND "affiliateRateBps" IS NOT NULL AND "affiliateSource" IS NOT NULL
 AND "affiliateRateBps" BETWEEN 1 AND 10000
 AND ((intent = 'purchase' AND "affiliateSource" IN ('code', 'cookie'))
   OR (intent = 'top-up' AND "affiliateSource" = 'original-order' AND "topUpForOrderId" IS NOT NULL AND "topUpForIccid" IS NOT NULL))));

CREATE OR REPLACE FUNCTION public.affiliate_frozen_checkout() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(OLD."affiliateId", OLD."affiliateCode", OLD."affiliateRateBps", OLD."affiliateSource")
    IS DISTINCT FROM ROW(NEW."affiliateId", NEW."affiliateCode", NEW."affiliateRateBps", NEW."affiliateSource")
    OR (OLD."affiliateId" IS NOT NULL AND ROW(OLD."totalCents", OLD.currency, OLD.intent, OLD."topUpForOrderId", OLD."topUpForIccid")
      IS DISTINCT FROM ROW(NEW."totalCents", NEW.currency, NEW.intent, NEW."topUpForOrderId", NEW."topUpForIccid")) THEN
    RAISE EXCEPTION 'Checkout affiliate terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
