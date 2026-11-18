ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AuditEvent" ADD COLUMN "actorEmail" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "details" TEXT;

CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
