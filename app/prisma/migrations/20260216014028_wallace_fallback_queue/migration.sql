-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "wallaceEntered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wallaceEnteredAt" TIMESTAMP(3);
