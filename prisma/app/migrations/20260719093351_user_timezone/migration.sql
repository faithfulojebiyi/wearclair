-- AlterTable
ALTER TABLE "sync_batches" ADD COLUMN     "content_hash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "timezone" TEXT;
