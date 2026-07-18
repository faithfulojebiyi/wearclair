-- DropIndex
DROP INDEX "sync_batches_status_created_at_idx";

-- AlterTable
ALTER TABLE "sync_batches" ADD COLUMN     "next_publish_attempt_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sync_batches_status_next_publish_attempt_at_idx" ON "sync_batches"("status", "next_publish_attempt_at");
