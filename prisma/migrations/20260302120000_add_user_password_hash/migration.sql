-- Add password hash support for credentials auth
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
