-- Enforce a one-checkout-to-one-order linkage so checkout fulfillment can reserve
-- the local order before making an upstream Airalo order request.
CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_orderId_key" ON "CheckoutSession"("orderId");

ALTER TABLE "CheckoutSession"
ADD CONSTRAINT "CheckoutSession_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
