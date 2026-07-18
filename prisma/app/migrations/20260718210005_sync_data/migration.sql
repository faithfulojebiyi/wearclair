/*
  Warnings:

  - The `status` column on the `sync_batches` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[device_id,client_batch_id]` on the table `sync_batches` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "sync_batches" ADD COLUMN     "client_batch_id" TEXT,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "publish_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "raw_written_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'RECEIVED';

-- DropEnum
DROP TYPE "sync_batch_status";

-- CreateIndex
CREATE INDEX "sync_batches_status_created_at_idx" ON "sync_batches"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_batches_device_id_client_batch_id_key" ON "sync_batches"("device_id", "client_batch_id");
