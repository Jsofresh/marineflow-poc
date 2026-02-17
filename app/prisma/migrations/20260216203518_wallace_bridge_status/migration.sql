-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "wallaceExternalId" TEXT,
ADD COLUMN     "wallaceSyncStatus" TEXT NOT NULL DEFAULT 'PENDING';
