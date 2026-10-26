-- AlterTable
ALTER TABLE "EsimOrder" ADD COLUMN     "replacementForId" TEXT,
ADD COLUMN     "saleCheckoutId" TEXT;

-- AlterTable
ALTER TABLE "CheckoutSession" ADD COLUMN     "activeOrderId" TEXT,
ADD COLUMN     "fulfillmentHold" TEXT;

-- CreateTable
CREATE TABLE "AdminOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "resultCode" TEXT,
    "reference" TEXT,
    "payload" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "reference" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "accountingAppliedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReview" (
    "eventKey" TEXT,
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsSettings" (
    "id" TEXT NOT NULL DEFAULT 'operations',
    "checkoutPaused" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCallbackDiagnostic" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCallbackDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminOperation_idempotencyKey_key" ON "AdminOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdminOperation_targetId_startedAt_idx" ON "AdminOperation"("targetId", "startedAt");

-- CreateIndex
CREATE INDEX "AdminOperation_status_leaseUntil_idx" ON "AdminOperation"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_operationId_key" ON "PaymentRefund"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_paymentId_reference_key" ON "PaymentRefund"("paymentId", "reference");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_status_idx" ON "PaymentRefund"("paymentId", "status");

-- CreateIndex
CREATE INDEX "IncidentReview_incidentId_createdAt_idx" ON "IncidentReview"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCallbackDiagnostic_correlationId_key" ON "PaymentCallbackDiagnostic"("correlationId");

-- CreateIndex
CREATE INDEX "PaymentCallbackDiagnostic_receivedAt_idx" ON "PaymentCallbackDiagnostic"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_activeOrderId_key" ON "CheckoutSession"("activeOrderId");

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_replacementForId_fkey" FOREIGN KEY ("replacementForId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_saleCheckoutId_fkey" FOREIGN KEY ("saleCheckoutId") REFERENCES "CheckoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_activeOrderId_fkey" FOREIGN KEY ("activeOrderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "AdminOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_positive_amount" CHECK ("amountCents" > 0);
CREATE UNIQUE INDEX "AdminOperation_one_active_mutation" ON "AdminOperation" ("targetId", "kind") WHERE status IN ('running','provider_pending','unknown') AND kind IN ('capture','cancel_payment','refund','replace_order','supplier_refund','catalog_sync');
INSERT INTO "OperationsSettings" (id, "updatedAt") VALUES ('operations', CURRENT_TIMESTAMP);

-- Defence in depth: every supplier claim, including callback and legacy paths,
-- serializes against the sale row changed by refunds and replacements.
CREATE FUNCTION public.guard_sale_fulfillment() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE sale public."CheckoutSession"%ROWTYPE;
BEGIN
 IF NEW.status = 'airalo_submitting' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   SELECT c.* INTO sale FROM public."CheckoutSession" c
   WHERE c.id = NEW."saleCheckoutId" OR c."orderId" = NEW.id FOR UPDATE;
   IF FOUND AND (sale."fulfillmentHold" IS NOT NULL OR COALESCE(sale."activeOrderId", sale."orderId") <> NEW.id) THEN
     RAISE EXCEPTION 'Sale fulfillment is held or superseded';
   END IF;
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_sale_fulfillment() FROM PUBLIC;
CREATE TRIGGER guard_sale_fulfillment BEFORE INSERT OR UPDATE ON "EsimOrder" FOR EACH ROW EXECUTE FUNCTION public.guard_sale_fulfillment();

ALTER TABLE "AdminOperation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AdminOperation" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "AdminOperation" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "AdminOperation" FROM authenticated; END IF;
END $$;

ALTER TABLE "PaymentRefund" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PaymentRefund" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "PaymentRefund" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "PaymentRefund" FROM authenticated; END IF;
END $$;

ALTER TABLE "IncidentReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "IncidentReview" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "IncidentReview" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "IncidentReview" FROM authenticated; END IF;
END $$;

ALTER TABLE "OperationsSettings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "OperationsSettings" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "OperationsSettings" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "OperationsSettings" FROM authenticated; END IF;
END $$;

ALTER TABLE "PaymentCallbackDiagnostic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PaymentCallbackDiagnostic" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "PaymentCallbackDiagnostic" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "PaymentCallbackDiagnostic" FROM authenticated; END IF;
END $$;

CREATE UNIQUE INDEX "IncidentReview_eventKey_key" ON "IncidentReview" ("eventKey");

-- Adopt existing external refund adjustments once, without replaying money movement.
-- Ambiguous multi-payment checkouts keep their legacy capacity deductions for review.
INSERT INTO "AdminOperation" (id,"idempotencyKey",kind,"targetId","actorEmail",reason,"expectedVersion",status,"resultCode",reference,payload,"startedAt","updatedAt","leaseUntil")
SELECT 'legacy-refund-'||a.id, 'legacy-refund-'||a.id, 'record_refund', p.id, a."actorEmail", a.reason, 'legacy-import', 'succeeded', 'legacy_external_refund', a.reference, jsonb_build_object('saleId',c.id), a."createdAt", a."createdAt", a."createdAt"
FROM "AffiliateSaleAdjustment" a JOIN "CheckoutSession" c ON c.id=a."checkoutId"
JOIN "PaymentTransaction" p ON p."checkoutId"=c.id AND p.status='approved'
WHERE (SELECT count(*) FROM "PaymentTransaction" q WHERE q."checkoutId"=c.id AND q.status='approved')=1;
INSERT INTO "PaymentRefund" (id,"paymentId","operationId","amountCents",currency,status,reference,evidence,"createdAt","confirmedAt","accountingAppliedAt")
SELECT 'legacy-refund-'||a.id, o."targetId", o.id, a."saleRefundCents", c.currency, 'confirmed', a.reference, 'Previously recorded external refund adjustment', a."createdAt", a."createdAt", a."createdAt"
FROM "AffiliateSaleAdjustment" a JOIN "CheckoutSession" c ON c.id=a."checkoutId" JOIN "AdminOperation" o ON o.id='legacy-refund-'||a.id;
UPDATE "CheckoutSession" c SET "fulfillmentHold"='refunded' WHERE EXISTS (
 SELECT 1 FROM "PaymentTransaction" p WHERE p."checkoutId"=c.id AND p.status='approved'
 AND (SELECT COALESCE(sum(r."amountCents"),0) FROM "PaymentRefund" r WHERE r."paymentId"=p.id AND r.status='confirmed')>=p."amountCents"
);
ALTER TABLE "OperationsSettings" ADD CONSTRAINT "OperationsSettings_singleton" CHECK (id='operations');

DO $$ DECLARE tab text; BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  FOREACH tab IN ARRAY ARRAY['AdminOperation','PaymentRefund','IncidentReview','OperationsSettings','PaymentCallbackDiagnostic'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',tab);
  END LOOP;
  REVOKE ALL ON FUNCTION public.guard_sale_fulfillment() FROM service_role;
 END IF;
END $$;
