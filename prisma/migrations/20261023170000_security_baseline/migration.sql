-- CreateEnum
CREATE TYPE "DpoMode" AS ENUM ('test', 'live');

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_id" UUID NOT NULL,
    "airalo_operator_id" INTEGER,
    "activation_policy" TEXT,
    "apn" JSONB,
    "apn_type" TEXT,
    "apn_value" TEXT,
    "countries_json" JSONB,
    "coverages_json" JSONB,
    "esim_type" TEXT,
    "gradient_end" TEXT,
    "gradient_start" TEXT,
    "image_json" JSONB,
    "info" TEXT[],
    "install_window_days" INTEGER,
    "is_kyc_verify" BOOLEAN,
    "is_prepaid" BOOLEAN,
    "is_roaming" BOOLEAN,
    "other_info" TEXT,
    "plan_type" TEXT,
    "rechargeability" BOOLEAN,
    "style" TEXT,
    "title" TEXT NOT NULL,
    "topup_grace_window_days" INTEGER,
    "type" TEXT,
    "warning" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operator_id" UUID NOT NULL,
    "airalo_package_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "manual_installation" TEXT NOT NULL,
    "qr_installation" TEXT NOT NULL,
    "is_fair_usage_policy" BOOLEAN,
    "fair_usage_policy" TEXT,
    "net_price" DECIMAL(12,4),
    "price" DECIMAL(12,4) NOT NULL,
    "prices_net_price" JSONB,
    "prices_recommended_retail_price" JSONB,
    "short_info" TEXT,
    "text" INTEGER,
    "voice" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_state" (
    "package_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMP(3),
    "base_price_cents" INTEGER NOT NULL DEFAULT 0,
    "selling_price_cents" INTEGER,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "source_price_decimal" DECIMAL(12,4),
    "sell_price_decimal" DECIMAL(12,4),
    "last_synced_at" TIMESTAMP(3),
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_state_pkey" PRIMARY KEY ("package_id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'airalo',
    "triggered_by" TEXT NOT NULL DEFAULT 'system',
    "version" TEXT,
    "notes" TEXT,
    "error_summary" TEXT,
    "inserted_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_sync_pages" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "links_json" JSONB,
    "meta_json" JSONB,
    "pricing_json" JSONB,
    "raw_payload_json" JSONB,
    "country_count" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_sync_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_hash" TEXT,
    "after_hash" TEXT,
    "diff_json" JSONB,
    "warning_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_key" TEXT NOT NULL,
    "raw_payload_json" JSONB NOT NULL,
    "normalized_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "accessVersion" INTEGER NOT NULL DEFAULT 0,
    "packageId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerEmail" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentTransactionId" TEXT,
    "receipt_email" TEXT,
    "receipt_sent_at" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),

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
    "totalMb" DOUBLE PRECISION,
    "status" TEXT,
    "expiredAt" TIMESTAMP(3),
    "isUnlimited" BOOLEAN,
    "remainingVoiceMinutes" INTEGER,
    "totalVoiceMinutes" INTEGER,
    "remainingTextMessages" INTEGER,
    "totalTextMessages" INTEGER,
    "rawPayload" JSONB,
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
CREATE TABLE "airalo_order_snapshots" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "source" TEXT NOT NULL,
    "request_id" TEXT,
    "order_number" TEXT,
    "raw_payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airalo_order_snapshots_pkey" PRIMARY KEY ("id")
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
    "quoteId" TEXT,
    "userId" TEXT,
    "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "accessVersion" INTEGER NOT NULL DEFAULT 0,
    "packageId" UUID NOT NULL,
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
    "affiliateId" TEXT,
    "affiliateCode" TEXT,
    "affiliateRateBps" INTEGER,
    "affiliateSource" TEXT,
    "affiliateCheckedAt" TIMESTAMP(3),

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "DpoSettings" (
    "id" TEXT NOT NULL DEFAULT 'dpo',
    "activeMode" "DpoMode" NOT NULL DEFAULT 'test',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DpoSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ownershipReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "dpoMode" "DpoMode",
    "providerReference" TEXT,
    "transactionToken" TEXT,
    "redirectUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerCode" TEXT,
    "providerExplanation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
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
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "transitionVersion" INTEGER,
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
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "preferredCurrency" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "emailProofAt" TIMESTAMP(3),
    "emailProofSource" TEXT,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "recoveryRequired" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'oauth',
    "email" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "idToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "sessionState" TEXT,
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
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
CREATE UNIQUE INDEX "countries_country_code_key" ON "countries"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_slug_key" ON "countries"("slug");

-- CreateIndex
CREATE INDEX "operators_country_id_idx" ON "operators"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "packages_airalo_package_id_key" ON "packages"("airalo_package_id");

-- CreateIndex
CREATE INDEX "packages_operator_id_idx" ON "packages"("operator_id");

-- CreateIndex
CREATE INDEX "package_state_is_active_idx" ON "package_state"("is_active");

-- CreateIndex
CREATE INDEX "package_state_last_synced_at_idx" ON "package_state"("last_synced_at");

-- CreateIndex
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "sync_runs_status_idx" ON "sync_runs"("status");

-- CreateIndex
CREATE INDEX "package_sync_pages_captured_at_idx" ON "package_sync_pages"("captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "package_sync_pages_run_id_page_key" ON "package_sync_pages"("run_id", "page");

-- CreateIndex
CREATE INDEX "sync_run_items_run_id_entity_type_idx" ON "sync_run_items"("run_id", "entity_type");

-- CreateIndex
CREATE INDEX "sync_run_items_entity_type_entity_key_idx" ON "sync_run_items"("entity_type", "entity_key");

-- CreateIndex
CREATE UNIQUE INDEX "sync_run_items_run_id_entity_type_entity_key_key" ON "sync_run_items"("run_id", "entity_type", "entity_key");

-- CreateIndex
CREATE INDEX "entity_snapshots_run_id_entity_type_idx" ON "entity_snapshots"("run_id", "entity_type");

-- CreateIndex
CREATE INDEX "entity_snapshots_entity_type_entity_key_created_at_idx" ON "entity_snapshots"("entity_type", "entity_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_orderNumber_key" ON "EsimOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_requestId_key" ON "EsimOrder"("requestId");

-- CreateIndex
CREATE INDEX "EsimOrder_userId_createdAt_idx" ON "EsimOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EsimOrder_status_updatedAt_idx" ON "EsimOrder"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EsimProfile_iccid_key" ON "EsimProfile"("iccid");

-- CreateIndex
CREATE INDEX "EsimProfile_orderId_idx" ON "EsimProfile"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "airalo_order_snapshots_order_id_idx" ON "airalo_order_snapshots"("order_id");

-- CreateIndex
CREATE INDEX "airalo_order_snapshots_request_id_idx" ON "airalo_order_snapshots"("request_id");

-- CreateIndex
CREATE INDEX "airalo_order_snapshots_order_number_idx" ON "airalo_order_snapshots"("order_number");

-- CreateIndex
CREATE INDEX "airalo_order_snapshots_source_created_at_idx" ON "airalo_order_snapshots"("source", "created_at");

-- CreateIndex
CREATE INDEX "EsimOrderRecoveryAttempt_orderId_createdAt_idx" ON "EsimOrderRecoveryAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EsimInstallationPayload_orderId_key" ON "EsimInstallationPayload"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_quoteId_key" ON "CheckoutSession"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_orderId_key" ON "CheckoutSession"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutSession_affiliateId_createdAt_idx" ON "CheckoutSession"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutQuote_expiresAt_idx" ON "CheckoutQuote"("expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutQuote_userId_idx" ON "CheckoutQuote"("userId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_checkoutId_createdAt_idx" ON "PaymentTransaction"("checkoutId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_transactionToken_idx" ON "PaymentTransaction"("transactionToken");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerReference_idx" ON "PaymentTransaction"("providerReference");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_updatedAt_idx" ON "PaymentTransaction"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransactionEvent_transactionId_transitionVersion_key" ON "PaymentTransactionEvent"("transactionId", "transitionVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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
CREATE UNIQUE INDEX "UserIdentity_provider_providerUserId_key" ON "UserIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleJob_businessKey_key" ON "LifecycleJob"("businessKey");

-- CreateIndex
CREATE INDEX "LifecycleJob_status_nextAttemptAt_idx" ON "LifecycleJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptDelivery_businessKey_key" ON "ReceiptDelivery"("businessKey");

-- CreateIndex
CREATE INDEX "ReceiptDelivery_status_nextAttemptAt_idx" ON "ReceiptDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ReceiptDelivery_orderId_idx" ON "ReceiptDelivery"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_state" ADD CONSTRAINT "package_state_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sync_pages" ADD CONSTRAINT "package_sync_pages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_run_items" ADD CONSTRAINT "sync_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_snapshots" ADD CONSTRAINT "entity_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "airalo_order_snapshots" ADD CONSTRAINT "airalo_order_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "EsimOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrderRecoveryAttempt" ADD CONSTRAINT "EsimOrderRecoveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimInstallationPayload" ADD CONSTRAINT "EsimInstallationPayload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransactionEvent" ADD CONSTRAINT "PaymentTransactionEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptDelivery" ADD CONSTRAINT "ReceiptDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EsimOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;


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


ALTER TABLE "User" ADD CONSTRAINT "User_preferredCurrency_check"
  CHECK ("preferredCurrency" IS NULL OR "preferredCurrency" IN ('USD', 'NAD', 'ZAR', 'EUR', 'GBP'));
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_amounts_check"
  CHECK ("quantity" = 1 AND "currency" = 'NAD' AND "sourceZarCents" > 0
    AND "totalCents" = "sourceZarCents" AND "displayCents" > 0
    AND "displayCurrency" IN ('USD', 'NAD', 'ZAR', 'EUR', 'GBP'));


CREATE INDEX "CheckoutSession_packageId_idx" ON "CheckoutSession" ("packageId");
CREATE INDEX "EsimOrder_packageId_idx" ON "EsimOrder" ("packageId");
CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'admin',
    FALSE
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_role(), public.affiliate_immutable_ledger(), public.affiliate_frozen_checkout(), public.affiliate_frozen_fulfilment(), public.affiliate_frozen_commission() FROM PUBLIC;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
DO $backend_access$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', client_role);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', client_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', client_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', client_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', client_role);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
  END IF;
END;
$backend_access$;
INSERT INTO "DpoSettings" (id, "activeMode", "updatedAt") VALUES ('dpo', 'test', CURRENT_TIMESTAMP);
INSERT INTO "AffiliateProgramSettings" (id, enabled, "updatedAt") VALUES ('program', false, CURRENT_TIMESTAMP);
