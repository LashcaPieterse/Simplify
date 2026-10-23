-- Add receipt tracking for eSIM orders
ALTER TABLE "EsimOrder"
ADD COLUMN IF NOT EXISTS "receipt_email" TEXT,
ADD COLUMN IF NOT EXISTS "receipt_sent_at" TIMESTAMP(3);
