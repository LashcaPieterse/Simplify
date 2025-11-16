-- AlterTable
ALTER TABLE "AiraloPackage" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AiraloPackage" ADD COLUMN "deactivatedAt" DATETIME;
