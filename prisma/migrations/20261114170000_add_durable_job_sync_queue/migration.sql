CREATE TYPE "JobSyncTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "JobSyncTask" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "JobSyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSyncTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobSyncTask_dedupeKey_key" ON "JobSyncTask"("dedupeKey");
CREATE INDEX "JobSyncTask_status_runAt_idx" ON "JobSyncTask"("status", "runAt");
CREATE INDEX "JobSyncTask_status_lockExpiresAt_idx" ON "JobSyncTask"("status", "lockExpiresAt");
